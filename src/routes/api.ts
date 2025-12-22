import { WalletService } from "../services/WalletService.ts";
import { ValidationService } from "../services/ValidationService.ts";
import { ValidationError, ServerError } from "../types/index.ts";

export class ApiRoutes {
  static async handleCheck(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const txhash = url.searchParams.get("txhash");
      const viewkey = url.searchParams.get("viewkey");
      const address = url.searchParams.get("address");

      // Validate input parameters
      const validationError = ValidationService.validateInputs(txhash, viewkey, address);
      if (validationError) {
        const error: ValidationError = { error: validationError };
        return new Response(JSON.stringify(error), {
          status: 400,
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // Update wallet node connection
      await WalletService.updateNode();

      // Check transaction
      const txRes = await WalletService.checkTxKey(txhash!, viewkey!, address!);

      return new Response(JSON.stringify(txRes), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[!] API error:", error);

      const serverError: ServerError = {
        error: "Internal server error",
        message: errorMessage
      };

      return new Response(JSON.stringify(serverError), {
        status: 500,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }

  static handleOptions(): Response {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
}