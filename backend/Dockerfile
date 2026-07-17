# Etapa 1: build con Maven (cachea dependencias en una capa separada del código fuente)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# Etapa 2: runtime — solo el JRE y el jar final, sin Maven ni el código fuente
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/sagab-backend-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
