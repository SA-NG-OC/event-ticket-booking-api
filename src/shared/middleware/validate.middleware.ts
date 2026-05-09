import { Request, Response, NextFunction } from "express";
import { ZodObject } from "zod";

export const validate =
    (schema: ZodObject<any>) =>
        async (req: Request, _res: Response, next: NextFunction) => {
            try {
                const parsed = await schema.parseAsync({
                    body: req.body,
                    query: req.query,
                    params: req.params,
                });

                if (parsed.body) {
                    Object.assign(req.body, parsed.body);
                }

                if (parsed.query) {
                    Object.assign(req.query, parsed.query);
                }

                if (parsed.params) {
                    Object.assign(req.params, parsed.params);
                }

                next();
            } catch (error) {
                next(error);
            }
        };