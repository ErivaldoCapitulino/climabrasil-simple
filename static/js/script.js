document.addEventListener("DOMContentLoaded", function () {
  // Elementos DOM
  const citySelect = document.getElementById("citySelect");
  const otherCity = document.getElementById("otherCity");
  const otherCityGroup = document.getElementById("otherCityGroup");
  const weatherForm = document.getElementById("weatherForm");
  const weatherBtn = document.getElementById("weatherBtn");
  const weatherResult = document.getElementById("weatherResult");

  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatSubmit = document.getElementById("chatSubmit");
  const chatMessages = document.getElementById("chatMessages");
  const newMessageIndicator = document.getElementById("newMessageIndicator");

  // Estado da aplicação
  let currentWeatherData = null;
  let isUserAtBottom = true;
  let typingInterval = 20; // Velocidade da digitação (ms por caractere)

  // Mostrar/ocultar campo para outras cidades
  citySelect.addEventListener("change", function () {
    otherCityGroup.style.display = this.value === "other" ? "block" : "none";
  });

  // Observar posição de rolagem do chat
  chatMessages.addEventListener("scroll", function () {
    const threshold = 100;
    isUserAtBottom =
      chatMessages.scrollTop + chatMessages.clientHeight >=
      chatMessages.scrollHeight - threshold;

    if (isUserAtBottom) {
      hideNewMessageIndicator();
    }
  });

  // Buscar dados meteorológicos
  weatherForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const city =
      citySelect.value === "other" ? otherCity.value.trim() : citySelect.value;

    if (!city) {
      showAlert("Por favor, selecione ou digite uma cidade", "error");
      return;
    }

    setLoading(
      true,
      weatherBtn,
      '<i class="fas fa-spinner spinner"></i> Buscando...'
    );

    try {
      const response = await fetch("/get-weather", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `city=${encodeURIComponent(city)}`,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao buscar dados");
      }

      const data = await response.json();

      if (!data || !data.city) {
        throw new Error("Dados incompletos recebidos");
      }

      currentWeatherData = data;
      displayWeatherData(data);

      chatInput.disabled = false;
      chatSubmit.disabled = false;

      addBotMessageWithTyping(`
                Aqui estão os dados de ${data.city}. 
                Posso te ajudar a interpretá-los ou dar recomendações. 
                O que você gostaria de saber?
            `);
    } catch (error) {
      console.error("Erro:", error);
      showAlert(
        error.message || "Erro ao buscar dados meteorológicos",
        "error"
      );
    } finally {
      setLoading(
        false,
        weatherBtn,
        '<i class="fas fa-search"></i> Buscar Dados'
      );
    }
  });

  // Exibir dados meteorológicos
  function displayWeatherData(data) {
    document.getElementById("cityName").textContent = data.city;
    document.getElementById(
      "weatherDate"
    ).textContent = `Atualizado em: ${data.localtime}`;

    const alertBadge = document.getElementById("weatherAlert");
    alertBadge.textContent =
      data.alert_level === "danger"
        ? "Alerta Máximo"
        : data.alert_level === "warning"
        ? "Alerta Moderado"
        : "Condições Normais";
    alertBadge.className = `alert-badge ${data.alert_level || "info"}`;

    document.getElementById("temperature").textContent = `${data.temp_c}°C`;
    document.getElementById("feelsLike").textContent = `${data.feelslike_c}°C`;
    document.getElementById("condition").textContent = data.condition;
    document.getElementById(
      "wind"
    ).textContent = `${data.wind_kph} km/h, ${data.wind_dir}`;
    document.getElementById("humidity").textContent = `${data.humidity}%`;
    document.getElementById(
      "precipitation"
    ).textContent = `${data.precip_mm} mm`;

    const actionsList = document.getElementById("actionsList");
    actionsList.innerHTML = "";

    if (data.actions && data.actions.length > 0) {
      data.actions.forEach((action) => {
        const li = document.createElement("li");
        li.innerHTML = action;
        actionsList.appendChild(li);
      });
    }

    weatherResult.classList.remove("hidden");
  }

  // Enviar mensagem no chat
  chatForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const question = chatInput.value.trim();

    if (!question || !currentWeatherData) return;

    addMessage(question, "user");
    chatInput.value = "";

    setLoading(true, chatSubmit, '<i class="fas fa-spinner spinner"></i>');
    chatInput.disabled = true;

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
          context: {
            has_weather_data: true,
            city: currentWeatherData.city,
            region: currentWeatherData.region,
            localtime: currentWeatherData.localtime,
            temp_c: currentWeatherData.temp_c,
            feelslike_c: currentWeatherData.feelslike_c,
            condition: currentWeatherData.condition,
            wind_kph: currentWeatherData.wind_kph,
            wind_dir: currentWeatherData.wind_dir,
            humidity: currentWeatherData.humidity,
            precip_mm: currentWeatherData.precip_mm,
            risk_level: currentWeatherData.risk_level,
            message: currentWeatherData.message,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na resposta do servidor");
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      addBotMessageWithTyping(data.answer);
    } catch (error) {
      console.error("Erro no chat:", error);
      addBotMessageWithTyping(
        "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente."
      );
    } finally {
      setLoading(false, chatSubmit, '<i class="fas fa-paper-plane"></i>');
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  // Funções auxiliares
  function showAlert(message, type = "info") {
    console.log(`[${type}] ${message}`);
    alert(message);
  }

  function setLoading(isLoading, button, content) {
    button.disabled = isLoading;
    button.innerHTML = content;
  }

  function scrollChatToBottom() {
    chatMessages.scrollTo({
      top: chatMessages.scrollHeight,
      behavior: "smooth",
    });
  }

  function showNewMessageIndicator() {
    if (!isUserAtBottom) {
      newMessageIndicator.classList.add("visible");
      newMessageIndicator.classList.remove("hidden");

      newMessageIndicator.addEventListener("click", function () {
        scrollChatToBottom();
        hideNewMessageIndicator();
      });
    }
  }

  function hideNewMessageIndicator() {
    newMessageIndicator.classList.remove("visible");
    newMessageIndicator.classList.add("hidden");
  }

  function addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message new-message-notification`;
    messageDiv.innerHTML = `<p>${text}</p>`;

    setTimeout(() => {
      messageDiv.classList.remove("new-message-notification");
    }, 500);

    chatMessages.appendChild(messageDiv);

    if (!isUserAtBottom) {
      showNewMessageIndicator();
    } else {
      scrollChatToBottom();
    }
  }

  function addBotMessageWithTyping(text, speed = null) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message bot-message";
    const messageContent = document.createElement("p");
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);

    scrollChatToBottom();

    let i = 0;
    const typingSpeed = speed || typingInterval;

    function typeWriter() {
      if (i < text.length) {
        messageContent.innerHTML += text.charAt(i);
        i++;

        if (i % 3 === 0) {
          scrollChatToBottom();
        }

        setTimeout(typeWriter, typingSpeed);
      }
    }

    typeWriter();
  }

  // Mensagem inicial com atraso para melhor experiência
  setTimeout(() => {
    addBotMessageWithTyping(
      "Olá! Sou o assistente do ClimaBrasil. Busque dados de uma cidade para que eu possa te ajudar com informações específicas."
    );
  }, 500);
});
