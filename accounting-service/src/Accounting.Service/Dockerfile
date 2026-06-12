# ============================================================
# Accounting Service — C# .NET 10.0 Worker Service
# ============================================================

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY ["Accounting.Service.csproj", "./"]
RUN dotnet restore

# Copy source and build
COPY . .
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Create data directory for SQLite
RUN mkdir -p /app/data

COPY --from=build /app/publish .

# Expose the service port (for health/metrics if needed)
EXPOSE 5000

ENTRYPOINT ["dotnet", "Accounting.Service.dll"]
