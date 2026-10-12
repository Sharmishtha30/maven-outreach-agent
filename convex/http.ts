import { httpRouter, componentsGeneric } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";
const http = httpRouter();
auth.addHttpRoutes(http);
registerStaticRoutes(http, (componentsGeneric() as any).staticHosting);
export default http;
