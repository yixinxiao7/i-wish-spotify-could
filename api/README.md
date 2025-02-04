# API Documentation

This folder contains the FastAPI application for the project. The FastAPI app serves as the backend, providing endpoints for the UI to interact with.

## Structure

- **app/**: Contains the main application code.
  - **main.py**: The entry point for the FastAPI application.
  - **routers/**: Contains route definitions and related modules.

## Setup

To set up the FastAPI application, ensure you have the required dependencies listed in `requirements.txt`. You can install them using:

```
pip install -r requirements.txt
```

## Running the API

To run the FastAPI application, execute the following command in the terminal:

```
uvicorn app.main:app --reload
```

This will start the server in development mode, allowing you to see changes without restarting.

## API Endpoints

Refer to the route definitions in the `routers` directory for available API endpoints and their usage.