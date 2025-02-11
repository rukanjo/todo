document.addEventListener("DOMContentLoaded", () => {
  const operatorsTasks = document.getElementById("operators-tasks");
  const workersTasks = document.getElementById("workers-tasks");
  const managersTasks = document.getElementById("managers-tasks");
  const completedTasksList = document.getElementById("completed-tasks-list");
  let tasks = [];
  let currentTaskId = null;

  // Функция для загрузки задач
  async function loadTasks() {
      try {
        const response = await fetch("/tasks");
        tasks = await response.json();
        renderTasks();
      } catch (error) {
        console.error("Error loading tasks:", error);
      }
  }
  // Функция для обновления статуса задачи
  async function updateTaskStatus(taskId, newStatus) {
      try {
        if (newStatus === "deleted") {
          await fetch(`/tasks/${taskId}`, { method: "DELETE" });
        } else {
          await fetch(`/tasks/${taskId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
        }
        loadTasks();
      } catch (error) {
        console.error("Error updating task status:", error);
    }
  }

  // Инициализация SortableJS
  const columns = [operatorsTasks, workersTasks, managersTasks];
  columns.forEach((column) => {
    Sortable.create(column, {
      group: "tasks",
      animation: 150,
      onEnd: async (event) => {
        const taskId = event.item.dataset.id;
        const newStatus = getColumnStatus(event.to.id);
        await updateTaskStatus(taskId, newStatus);
      },
    });
  });

  // Обработчики открытия модальных окон
  document.getElementById("add-task-btn").onclick = () => openModal("add-task-modal");
  document.getElementById("statistics-btn").onclick = () => {
    openModal("statistics-modal");
    updateStatistics();
  };

  // Общий обработчик закрытия модальных окон
  window.onclick = (event) => {
    const modals = ["add-task-modal", "statistics-modal", "task-modal"];
    modals.forEach((modalId) => {
      const modal = document.getElementById(modalId);
      if (event.target === modal) modal.style.display = "none";
    });
  };

  // Функция для открытия модального окна
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = "block";
  }

  // Функция для закрытия модального окна
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = "none";
  }

  // Закрытие модальных окон при клике на крестик
  document.querySelectorAll(".close").forEach((closeButton) => {
    closeButton.onclick = () => {
      const modalId = closeButton.closest(".modal").id;
      closeModal(modalId);
    };
  });

  // Функция для добавления задачи через API
  async function addTask(title, description) {
    try {
      const response = await fetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add task");
      }
      const newTask = await response.json();
      tasks.push(newTask); // Добавляем новую задачу в массив
      renderTasks(); // Перерисовываем задачи
      closeModal("add-task-modal"); // Закрываем модальное окно
    } catch (error) {
      console.error("Error adding task:", error);
      alert("Не удалось добавить задачу. Попробуйте снова.");
    }
  }
  //Функция для добавления задачи через модальное окно
  document.getElementById("add-task-form").onsubmit = async event => {
    event.preventDefault(); // Предотвращаем стандартное поведение формы

    const title = document.getElementById("task-title").value.trim();
    const description = document.getElementById("task-description").value.trim();

    if (!title) {
        alert("Заголовок обязателен!");
        return;
    }

    try {
        // Отправляем POST-запрос на сервер
        const response = await fetch("/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to add task");
        }

        // Очищаем форму и закрываем модальное окно
        document.getElementById("add-task-form").reset();
        const modal = document.getElementById("add-task-modal");
        modal.style.display = "none";

        // Обновляем список задач
        loadTasks();
    } catch (error) {
        console.error("Error adding task:", error);
        alert("Не удалось добавить задачу. Попробуйте снова.");
    }
  };

  // Открытие/закрытие списка завершённых задач
  document.getElementById("show-completed-btn").onclick = () => {
    const container = document.getElementById("completed-tasks-container");
    if (container.style.display === "none") {
      container.style.display = "block";
      document.getElementById("show-completed-btn").textContent =
        "Скрыть завершённые задачи";
    } else {
      container.style.display = "none";
      document.getElementById("show-completed-btn").textContent =
        "Показать завершённые задачи";
    }
  };

  // Функция для отображения задач
  function renderTasks() {
    console.log("Rendering tasks..."); // Логирование
    [operatorsTasks, workersTasks, managersTasks, completedTasksList].forEach(
      (container) => (container.innerHTML = "")
    );
    tasks.forEach((task) => {
      const taskElement = createTaskElement(task);
      if (task.status === "new") {
        operatorsTasks.appendChild(taskElement);
      } else if (task.status === "in_progress") {
        workersTasks.appendChild(taskElement);
      } else if (task.status === "review") {
        managersTasks.appendChild(taskElement);
      } else if (task.status === "completed") {
        const listItem = document.createElement("li");
        listItem.textContent = task.title;
        listItem.dataset.id = task.id;
        listItem.onclick = () => openTaskModal(task);
        completedTasksList.appendChild(listItem);
      }
    });
  }

  // Функция для создания элемента задачи
  function createTaskElement(task) {
    const taskElement = document.createElement("div");
    taskElement.className = "task";
    taskElement.textContent = task.title;
    taskElement.draggable = true;
    taskElement.dataset.id = task.id;
    taskElement.addEventListener("click", () => openTaskModal(task));
    return taskElement;
  }

  // Функция для открытия модального окна задачи
  function openTaskModal(task) {
    const modal = document.getElementById("task-modal");
    const taskDetails = document.getElementById("task-details");
    taskDetails.textContent = task.description || "No description available.";
    currentTaskId = task.id;
    console.log("Открытая задача:", task); // Логирование
    openModal("task-modal");
  }

  // Кнопки "Переместить на следующий шаг" и "Отправить назад"
  document.getElementById("move-next-btn").onclick = async () => {
    if (!currentTaskId) {
      console.error("ID текущей задачи не установлен!");
      return;
    }
    const newStatus = getNextStatus(tasks.find((task) => task.id == currentTaskId)?.status);
    await updateTaskStatus(currentTaskId, newStatus);
    closeModal("task-modal");
  };
  
  document.getElementById("move-back-btn").onclick = async () => {
    if (!currentTaskId) {
      console.error("ID текущей задачи не установлен!");
      return;
    }
    const newStatus = getPreviousStatus(tasks.find((task) => task.id == currentTaskId)?.status);
    await updateTaskStatus(currentTaskId, newStatus);
    closeModal("task-modal");
  };

  // Кнопка "Удалить задачу"
  document.getElementById("delete-task-btn").onclick = async () => {
    try {
      await fetch(`/tasks/${currentTaskId}`, { method: "DELETE" });
      loadTasks();
      closeModal("task-modal");
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Не удалось удалить задачу. Попробуйте снова.");
    }
  };

  // Функции для получения следующего/предыдущего статуса
  function getNextStatus(currentStatus) {
    switch (currentStatus) {
      case "new":
        return "in_progress";
      case "in_progress":
        return "review";
      case "review":
        return "completed";
      default:
        return "completed";
    }
  }

  function getPreviousStatus(currentStatus) {
    switch (currentStatus) {
      case "in_progress":
        return "new";
      case "review":
        return "in_progress";
      case "completed":
        return "review";
      default:
        return "new";
    }
  }

  // Функция для обновления статистики
  function updateStatistics() {
    const totalTasks = tasks.length;
    const newTasks = tasks.filter((task) => task.status === "new").length;
    const inProgressTasks = tasks.filter((task) => task.status === "in_progress").length;
    const reviewTasks = tasks.filter((task) => task.status === "review").length;
    const completedTasks = tasks.filter((task) => task.status === "completed").length;

    // Обновляем текстовое содержимое
    document.getElementById("total-tasks").textContent = totalTasks;
    document.getElementById("new-tasks-percentage").textContent = `${Math.round(
      (newTasks / totalTasks) * 100 || 0
    )}%`;
    document.getElementById("in-progress-tasks-percentage").textContent = `${Math.round(
      (inProgressTasks / totalTasks) * 100 || 0
    )}%`;
    document.getElementById("review-tasks-percentage").textContent = `${Math.round(
      (reviewTasks / totalTasks) * 100 || 0
    )}%`;
    document.getElementById("completed-tasks-percentage").textContent = `${Math.round(
      (completedTasks / totalTasks) * 100 || 0
    )}%`;

    // Обновляем ширину цветовых полос
    document.getElementById("new-tasks-fill").style.width = `${Math.round(
      (newTasks / totalTasks) * 100 || 0
    )}%`;
    document.getElementById("in-progress-tasks-fill").style.width = `${Math.round(
      (inProgressTasks / totalTasks) * 100 || 0
    )}%`;
    document.getElementById("review-tasks-fill").style.width = `${Math.round(
      (reviewTasks / totalTasks) * 100 || 0
    )}%`;
    document.getElementById("completed-tasks-fill").style.width = `${Math.round(
      (completedTasks / totalTasks) * 100 || 0
    )}%`;
  }

  // Получение статуса по ID столбца
  function getColumnStatus(columnId) {
    switch (columnId) {
      case "operators-tasks":
        return "new";
      case "workers-tasks":
        return "in_progress";
      case "managers-tasks":
        return "review";
      case "completed-tasks-list":
        return "completed";
      case "delete-tasks":
        return "deleted";
      default:
        return "new";
    }
  }



  // Инициализация
  loadTasks();
});