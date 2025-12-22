

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
}