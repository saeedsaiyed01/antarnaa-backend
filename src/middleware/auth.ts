// src/middleware/auth.ts
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const verifyToken = (
  roles: string[]
): RequestHandler<ParamsDictionary, any, any, ParsedQs> => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.error("Authorization header missing or malformed");
      res.status(401).json({ error: "Unauthorized: Token missing" });
      return;
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      console.log("Decoded token:", decoded);

      if (!roles.includes((decoded as any).role)) {
        console.error(
          "Role mismatch. Required roles:",
          roles,
          "User role:",
          (decoded as any).role
        );
        res.status(403).json({ error: "Forbidden: Role mismatch" });
        return;
      }

      req.user = decoded;
      next();
    } catch (err) {
      console.error("Token verification failed:", err);
      res.status(401).json({ error: "Invalid Token" });
    }
  };
};
