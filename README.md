# My Project

This project is a full-stack application that consists of a Next.js frontend and a FastAPI backend.

## Project Structure

- **ui/**: Contains the frontend application built with Next.js.
  - **pages/**: Contains the pages of the Next.js application.
  - **public/**: Stores static assets such as images and fonts.
  - **styles/**: Contains global CSS styles.
  - **package.json**: Configuration file for npm.
  - **tsconfig.json**: TypeScript configuration file.
  - **README.md**: Documentation specific to the UI part of the project.

- **api/**: Contains the backend application built with FastAPI.
  - **app/**: Contains the main application files for FastAPI.
    - **main.py**: Entry point for the FastAPI application.
    - **routers/**: Contains route definitions for the FastAPI application.
      - **__init__.py**: Initializes the routers for the FastAPI application.
  - **requirements.txt**: Lists the dependencies required for the FastAPI application.
  - **README.md**: Documentation specific to the API part of the project.

## Getting Started

### Prerequisites

- Node.js and npm for the frontend.
- Python and pip for the backend.

### Installation

1. **Frontend (Next.js)**:
   - Navigate to the `ui` directory.
   - Run `npm install` to install the dependencies.

2. **Backend (FastAPI)**:
   - Navigate to the `api` directory.
   - Run `pip install -r requirements.txt` to install the dependencies.

### Running the Application

- **Frontend**: 
  - Navigate to the `ui` directory and run `npm run dev` to start the Next.js application.

- **Backend**: 
  - Navigate to the `api/app` directory and run `uvicorn main:app --reload` to start the FastAPI application.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.