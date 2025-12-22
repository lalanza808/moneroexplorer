

export class NodeService {
  private static fallbackNode = "https://node.sethforprivacy.com";

  static async getNode(): Promise<string> {
    const node = Deno.env.get("NODE");
    if (node) return node
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

  static async make_rpc_request(method: string, params: any = {}): Promise<any> {
    const node = await NodeService.getNode();
    const url = `${node}/${method}`
    const headers = {"Content-Type": "application/json"};
    let resp = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(params),
    });
    return resp
  }
  
}
