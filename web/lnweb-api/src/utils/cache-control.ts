// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import type { NextFunction, Request, Response } from "express";

type CacheControlOptions = {
  maxAge?: number;
  sMaxAge?: number;
};

/**
 * Create Express middleware that sets a public Cache-Control header with the provided max-age and s-maxage for GET and HEAD requests.
 */
export function setCacheControl({ maxAge, sMaxAge }: CacheControlOptions = {}) {
  const sanitizeAge = (value?: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Math.floor(parsed);
  };

  const normalizedMaxAge = sanitizeAge(maxAge);
  const normalizedSMaxAge = sanitizeAge(sMaxAge);

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" || req.method === "HEAD") {
      const directives = ["public"];

      if (normalizedMaxAge !== null) {
        directives.push(`max-age=${normalizedMaxAge}`);
      }
      if (normalizedSMaxAge !== null) {
        directives.push(`s-maxage=${normalizedSMaxAge}`);
      }

      if (directives.length > 1) {
        res.set("Cache-Control", directives.join(", "));
      }
    }
    next();
  };
}

/**
 * Create Express middleware that disables client and proxy caching for GET and HEAD requests.
 */
export function setNoCache() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" || req.method === "HEAD") {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", new Date(0).toUTCString());
      res.setHeader("Surrogate-Control", "no-store");
    }
    next();
  };
}
