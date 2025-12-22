export class TemplateRenderer {
  private static templateCache = new Map<string, string>();
  
  static async loadTemplate(templateName: string): Promise<string> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }
    
    try {
      const templatePath = `./src/templates/${templateName}`;
      const content = await Deno.readTextFile(templatePath);
      this.templateCache.set(templateName, content);
      return content;
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      throw new Error(`Template not found: ${templateName}`);
    }
  }
  
  static parseBlocks(template: string): { blocks: Map<string, string>; content: string } {
    const blocks = new Map<string, string>();
    
    // Find all block definitions
    const blockRegex = /{% block (\w+) %}([\s\S]*?){% endblock %}/g;
    let match;
    
    while ((match = blockRegex.exec(template)) !== null) {
      const blockName = match[1];
      const blockContent = match[2].trim();
      blocks.set(blockName, blockContent);
    }
    
    return { blocks, content: template };
  }
  
  static parseExtends(template: string): string | null {
    const extendsRegex = /{% extends "([^"]+)" %}/;
    const match = template.match(extendsRegex);
    return match ? match[1] : null;
  }
  
  static replaceBlocks(baseTemplate: string, childBlocks: Map<string, string>): string {
    let result = baseTemplate;
    
    // Replace each block with content from child template
    for (const [blockName, blockContent] of childBlocks) {
      const blockRegex = new RegExp(`{% block ${blockName} %}[\\s\\S]*?{% endblock %}`, 'g');
      result = result.replace(blockRegex, blockContent);
    }
    
    // Remove any remaining empty blocks
    const remainingBlockRegex = /{% block \w+ %}[\s\S]*?{% endblock %}/g;
    result = result.replace(remainingBlockRegex, '');
    
    return result;
  }
  
  static parseForLoops(template: string, data: Record<string, any>): string {
    const forLoopRegex = /{% for (\w+) in (\w+) %}([\s\S]*?){% endfor %}/g;
    let result = template;
    
    let match;
    while ((match = forLoopRegex.exec(template)) !== null) {
      const itemVar = match[1];
      const iterableKey = match[2];
      const loopContent = match[3];
      
      if (!data[iterableKey]) {
        throw new Error(`Iterable '${iterableKey}' not found in data`);
      }
      
      const iterableItems = data[iterableKey];
      let renderedLoop = '';
      
      for (const item of iterableItems) {
        let iterationContent = loopContent;
        
        // Replace individual item variables within the loop
        const itemVariableRegex = new RegExp(`{{\\s*${itemVar}\\.(\\w+)\\s*}}`, 'g');
        iterationContent = iterationContent.replace(itemVariableRegex, (_, prop) => {
          return item[prop] !== undefined ? item[prop] : '';
        });
        
        renderedLoop += iterationContent;
      }
      
      result = result.replace(match[0], renderedLoop);
    }
    
    return result;
  }

  static replaceVariables(template: string, data: Record<string, any>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      // Skip objects or arrays that will be handled by parseForLoops
      if (typeof value === 'object' && value !== null) continue;
      
      const variableRegex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(variableRegex, value);
    }
    
    return result;
  }
  
  static async renderTemplate(templateName: string, data: Record<string, any> = {}): Promise<string> {
    try {
      // Load the template
      const template = await this.loadTemplate(templateName);
      
      // Check if template extends another template
      const extendsTemplateName = this.parseExtends(template);
      
      if (extendsTemplateName) {
        // Template inheritance
        const baseTemplate = await this.loadTemplate(extendsTemplateName);
        const { blocks: childBlocks } = this.parseBlocks(template);
        
        // Replace blocks in base template
        let result = this.replaceBlocks(baseTemplate, childBlocks);
        
        // Parse for loops
        result = this.parseForLoops(result, data);
        
        // Replace variables
        result = this.replaceVariables(result, data);
        
        return result;
      } else {
        // Simple template without inheritance
        let result = template;
        
        // Parse for loops
        result = this.parseForLoops(result, data);
        
        // Replace variables
        result = this.replaceVariables(result, data);
        
        return result;
      }
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      return `<h1>Template Error</h1><p>Could not render template: ${templateName}</p>`;
    }
  }
  
  // Method for direct rendering (for backward compatibility)
  static async renderDirect(templateName: string, data: Record<string, any> = {}): Promise<string> {
    try {
      const template = await this.loadTemplate(templateName);
      let result = template;
      
      // Parse for loops
      result = this.parseForLoops(result, data);
      
      // Replace variables
      result = this.replaceVariables(result, data);
      
      return result;
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      return `<h1>Template Error</h1><p>Could not render template: ${templateName}</p>`;
    }
  }
}