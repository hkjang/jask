import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../llm/llm.service';

@Injectable()
export class MetadataAiService {
  private readonly logger = new Logger(MetadataAiService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Generates a draft description for a table based on its name and columns.
   */
  async generateTableDescription(tableName: string, columns: any[]): Promise<string> {
    const prompt = `
    You are a Data Architect.
    Generate a concise but informative description (in Korean) for the database table named "${tableName}".
    
    Columns:
    ${columns.map(c => `- ${c.columnName} (${c.dataType})`).join('\n')}

    Description:
    `;

    try {
      const response = await this.llmService.generate({
        prompt,
        systemPrompt: "You are a helpful assistant that writes clear documentation for database tables."
      });
      return response.content.trim();
    } catch (e) {
      this.logger.error(`Failed to generate table description: ${e.message}`);
      return "";
    }
  }

  /**
   * Generates detailed metadata for logical columns (Semantic Name, Description, etc.)
   */
  async generateColumnMetadata(tableName: string, columns: any[]): Promise<any> {
    const prompt = `
    You are a Data Architect. analyze the following columns of table "${tableName}" and suggest metadata.
    
    Return a JSON object where keys are column names and values are objects with:
    - semanticName (Korean logical name)
    - description (Korean description)
    - unit (if applicable, e.g. 'krw', 'kg', 'ea', else null)
    - sensitivity (one of: PUBLIC, INTERNAL, CONFIDENTIAL, STRICT)

    Columns:
    ${columns.map(c => `- ${c.columnName} (${c.dataType})`).join('\n')}

    Output JSON Format Example:
    {
      "user_id": { "semanticName": "사용자 ID", "description": "사용자의 고유 식별자", "unit": null, "sensitivity": "INTERNAL" },
      "salary": { "semanticName": "급여", "description": "월 급여 금액", "unit": "KRW", "sensitivity": "CONFIDENTIAL" }
    }
    `;

    try {
      const response = await this.llmService.generate({
        prompt,
        systemPrompt: "You are a JSON generator. output ONLY valid JSON. Do not include markdown formatting.",
        temperature: 0.1
      });
      
      const cleanJson = response.content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      this.logger.error(`Failed to generate column metadata: ${e.message}`);
      return {};
    }
  }
}
