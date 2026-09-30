export type ToolResult = { success: boolean; output: string; evidence?: { type: string; description: string; url?: string } };

export type Tool = { name: string; execute(input: { action: string; target?: string }): Promise<ToolResult> };

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  register(tool: Tool) { this.tools.set(tool.name, tool); }
  get(name: string) { return this.tools.get(name); }
}
