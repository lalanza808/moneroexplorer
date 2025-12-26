export class NodeService {
  private static fallbackNode = "http://localhost:18081";
  private static cache: Map<string, { data: any }> = new Map();

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

  static getCache(method: string) {
    const res = this.cache.get(method);
    return res ? res.data : null
  }

  static getAge(timestamp: string | number | Date): number {
    const pastTime: number = new Date(timestamp * 1_000).getTime();
    const nowTime: number = Date.now();
    if (isNaN(pastTime)) {
      throw new Error('Invalid timestamp provided');
    }
    const diffMs: number = nowTime - pastTime;
    const diffSeconds: number = Math.round(diffMs / 1_000);
    return Math.max(0, diffSeconds);
  }

  static async make_json_rpc_request(method: string, params: any = {}): Promise<any> {
    const node = await NodeService.getNode();
    const url = `${node}/json_rpc`;
    const headers = {"Content-Type": "application/json"};
    const payload = {
      jsonrpc: "2.0",
      method: method,
      params: ""
    };
    if (params) {
      payload.params = params;
    }
    const resp = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });
    const data = JSON.parse(await resp.text());
    this.cache.set(method, {
      data: data
    })
    return data
  }

  static async make_rpc_request(method: string, params: any = {}): Promise<any> {
    const node = await NodeService.getNode();
    const url = `${node}/${method}`;
    const headers = {"Content-Type": "application/json"};
    const resp = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(params),
    });
    const data = JSON.parse(await resp.text());
    this.cache.set(method, {
      data: data
    })
    return data
  }
  
}
