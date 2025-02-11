package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// Task представляет структуру задачи
type Task struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"` // Теперь строка
	Status      string    `json:"status"`
	Done        bool      `json:"done"`
	DeletedAt   time.Time `json:"deleted_at,omitempty"` // Дата удаления
}

func main() {
	// Подключение к базе данных
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	// Создание таблицы, если она не существует
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'new'
        )
    `)
	if err != nil {
		panic(err)
	}

	_, err = db.Exec(`
    CREATE TABLE IF NOT EXISTS deleted_tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'deleted',
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
	`)
	if err != nil {
		panic(err)
	}

	// Инициализация Gin
	r := gin.Default()

	// Обслуживание статических файлов
	r.Static("/static", "./static")
	r.LoadHTMLGlob("static/*.html")

	// Главная страница
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})

	// Маршрут для получения всех задач
	r.GET("/tasks", func(c *gin.Context) {
		rows, err := db.Query("SELECT id, title, description, status, done FROM tasks")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query error"})
			fmt.Println("Database query error:", err)
			return
		}
		defer rows.Close()

		var tasks []Task
		for rows.Next() {
			var task Task
			if err := rows.Scan(&task.ID, &task.Title, &task.Description, &task.Status, &task.Done); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Row scan error"})
				fmt.Println("Row scan error:", err)
				return
			}

			// Заменяем пустое описание на "(пусто)"
			if task.Description == "" {
				task.Description = "(пусто)"
			}

			tasks = append(tasks, task)
		}

		c.JSON(http.StatusOK, tasks)
	})

	// Маршрут для получения удаленных задач
	r.GET("/deleted-tasks", func(c *gin.Context) {
		rows, err := db.Query("SELECT id, title, description, status, deleted_at FROM deleted_tasks")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query error"})
			return
		}
		defer rows.Close()

		var deletedTasks []Task
		for rows.Next() {
			var task Task
			if err := rows.Scan(&task.ID, &task.Title, &task.Description, &task.Status, &task.DeletedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Row scan error"})
				return
			}
			deletedTasks = append(deletedTasks, task)
		}

		c.JSON(http.StatusOK, deletedTasks)
	})

	// Маршрут для добавления новой задачи
	r.POST("/tasks", func(c *gin.Context) {
		var newTask Task

		// Логирование сырого тела запроса
		body, _ := c.GetRawData()
		fmt.Println("Raw request body:", string(body))

		// Парсинг JSON
		if err := json.Unmarshal(body, &newTask); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
			fmt.Println("Error parsing JSON:", err)
			return
		}

		// Проверка обязательного поля title
		if newTask.Title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
			return
		}
		// Заменяем пустое описание на "(пусто)"
		if newTask.Description == "" {
			newTask.Description = "(пусто)"
		}
		// Преобразование description в sql.NullString
		description := sql.NullString{
			String: newTask.Description,
			Valid:  newTask.Description != "", // Valid = true, если описание не пустое
		}

		// Устанавливаем статус "new" и значение "done" по умолчанию
		err := db.QueryRow("INSERT INTO tasks (title, description, status, done) VALUES ($1, $2, $3, $4) RETURNING id",
			newTask.Title, description, "new", false).Scan(&newTask.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			fmt.Println("Database error:", err)
			return
		}

		c.JSON(http.StatusCreated, newTask)
	})

	// Маршрут для обновления статуса задачи
	r.PUT("/tasks/:id/status", func(c *gin.Context) {
		id := c.Param("id")
		var updateData struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&updateData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, err := db.Exec("UPDATE tasks SET status = $1 WHERE id = $2", updateData.Status, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
	})
	//удаление задачи маршрут
	r.DELETE("/tasks/:id", func(c *gin.Context) {
		id := c.Param("id")

		// Получаем данные задачи перед удалением
		var task Task
		err := db.QueryRow("SELECT id, title, description, status FROM tasks WHERE id = $1", id).Scan(&task.ID, &task.Title, &task.Description, &task.Status)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}

		// Перемещаем задачу в таблицу deleted_tasks
		_, err = db.Exec("INSERT INTO deleted_tasks (id, title, description, status) VALUES ($1, $2, $3, $4)", task.ID, task.Title, task.Description, "deleted")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Удаляем задачу из основной таблицы
		_, err = db.Exec("DELETE FROM tasks WHERE id = $1", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Task moved to deleted_tasks"})
	})

	// Запуск сервера
	r.Run(":8080")
}
