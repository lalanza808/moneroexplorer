

export class NodeService {
  private static fallbackNode = "https://node.sethforprivacy.com";

  static async getNode(): Promise<string> {
    try {
      const contents = await Deno.readTextFile("nodes.json");
      const nodes = JSON.parse(contents);
      if (!Array.isArray(nodes) || nodes.length === 0) {
        console.warn("[!] No valid nodes found in nodes.json, using fallback node");
        return this.fallbackNode;
      }
      const randIndex = Math.floor(Math.random() * nodes.length);
      return nodes[randIndex];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[!] Failed to read nodes.json: ${errorMessage}, using fallback node`);
      return this.fallbackNode;
    }
  }

  static async make_json_rpc_request(method: string, params: any = {}): Promise<any> {
    const node = await NodeService.getNode();
    const url = `${node}/json_rpc`
    const headers = {"Content-Type": "application/json"};
    const payload = {
      jsonrpc: "2.0",
      method: method,
      params: ""
    };
    if (params) {
      payload.params = params;
    }
    let resp = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });
    return resp
  }

  // self._make_json_rpc_request("get_info")
  // def _make_json_rpc_request(self, method: str, params: Optional[Any] = None) -> Any:
  //       """
  //       Make a JSON-RPC 2.0 request to the node

  //       Args:
  //           method: JSON-RPC method name (e.g., 'get_info')
  //           params: Method parameters (dict, list, or None)

  //       Returns:
  //           Result from the JSON-RPC response

  //       Raises:
  //           MoneroNodeRPCError: On RPC or network errors
  //       """
  //       url = f"{self.base_url}/json_rpc"

  //       payload: Dict[str, Any] = {
  //           "jsonrpc": "2.0",
  //           "id": self._get_request_id(),
  //           "method": method,
  //       }

  //       if params is not None:
  //           payload["params"] = params

  //       try:
  //           response = self.session.post(url, json=payload, timeout=self.timeout)
  //           response.raise_for_status()

  //           data = response.json()

  //           # Check for JSON-RPC error
  //           if "error" in data:
  //               error = data["error"]
  //               error_msg = f"{error.get('code', 'Unknown')}: {error.get('message', 'Unknown error')}"
  //               logger.error(f"JSON-RPC error: {error_msg}")
  //               raise MoneroNodeRPCError(f"RPC error: {error_msg}")

  //           return data.get("result", {})

  //       except Timeout:
  //           logger.error(f"Request timeout for {url}")
  //           raise MoneroNodeRPCError(f"Request timeout: {url}")
  //       except RequestException as e:
  //           logger.error(f"Request failed for {url}: {str(e)}")
  //           raise MoneroNodeRPCError(f"Request failed: {str(e)}")
  //       except ValueError as e:
  //           logger.error(f"Invalid JSON response from {url}")
  //           raise MoneroNodeRPCError(f"Invalid JSON response: {str(e)}")


}

