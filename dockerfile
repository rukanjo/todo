# Базовый образ
FROM golang:1.22.2-alpine

# Рабочая директория
WORKDIR /app

# Копирование go.mod и go.sum
COPY go.mod go.sum ./

# Установка зависимостей
RUN go mod download

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN go build -o todo-microservice .

# Команда для запуска
CMD ["./todo-microservice"]