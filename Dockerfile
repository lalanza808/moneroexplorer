# Use the official Deno runtime as base image
FROM denoland/deno:2.6.3

# Set working directory
WORKDIR /app

# Copy dependency files first for better caching
COPY deno.json deno.lock ./

# Cache dependencies
RUN deno cache --lock=deno.lock deno.json

# Copy source code
COPY . .

# Cache the application modules
RUN deno cache --lock=deno.lock src/app.ts

# Expose port 8000
EXPOSE 8000

# Set environment variable for port (optional, Deno.serve defaults to 8000)
ENV PORT=8000

# Run the application
CMD ["deno", "run", "--allow-all", "src/app.ts"]