import { Request, Response, NextFunction } from "express";
import ErrorResponse from "../utils/errorResponse";

interface MongooseError extends Error {
  code?: number;
  errors?: { [key: string]: { message: string } };
}

interface CustomError extends Error {
  statusCode?: number;
}

const errorHandler = (
  err: MongooseError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: CustomError = { ...err };

  error.message = err.message;
  // log to console for developer
  if (process.env.NODE_ENV === "development") {
    console.log(err);
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = `Resource not found`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const message = `Duplicate field value entered`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = err.errors
      ? Object.values(err.errors)
          .map((value) => value.message)
          .join(", ")
      : "Validation Error";
    error = new ErrorResponse(message, 400);
  }

  if (process.env.NODE_ENV === "development") {
    console.log(err);
  }

  res
    .status(error.statusCode || 500)
    .json({ success: false, message: error.message || "Server Error" });
};

export default errorHandler;
