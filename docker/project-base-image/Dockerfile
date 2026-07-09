FROM node:20

WORKDIR /app

# Pre-install common frontend dependencies to speed up project startup
RUN npm install -g npm@latest vite@latest

#TODO: Uncomment this when we have a non-root usr (Allen)
# #Create a non-root user to run the app
# RUN groupadd -r appuser && useradd -r -g appuser -m appuser
# RUN chown -R appuser:appuser /app
# RUN chmod -R u+w /app

# # Switch to non-root user for security
# USER appuser

EXPOSE 5173

# The actual project code will be mounted as a volume
# The CMD will be provided when running the container
CMD ["sh", "-c", "npm install --include=dev && npm run dev -- --host 0.0.0.0"]