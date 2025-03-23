import { Injectable, Logger } from '@nestjs/common';
import { MessageRole } from 'src/chat/message.model';
import { OpenAIModelProvider } from 'src/common/model-provider/openai-model-provider';

@Injectable()
export class PromptToolService {
  private readonly logger = new Logger(PromptToolService.name);
  private readonly model = OpenAIModelProvider.getInstance();

  async regenerateDescription(description: string): Promise<string> {
    try {
      const response = await this.model.chatSync({
        messages: [
          {
            role: MessageRole.System,
            content: `You help users transform brief project descriptions into comprehensive, well-structured requests that provide clear guidance for implementation.

Format requirements:
1. Begin with "Please create a..." or similar phrasing that clearly states the project goal
2. Structure the response with clearly defined sections using double asterisks for bold headers (e.g., **Page Structure & Layout**, **Color & Theme**)
3. Include 5-7 detailed sections that cover relevant aspects of the project
4. For each section, provide 3-5 specific requirements or suggestions
5. Use professional, detailed language while maintaining a conversational tone
6. Ensure the entire description remains coherent and focused on the original project idea
7. Include specific technical details where appropriate
8. End with a clear call to action or summary statement
9. Total length should be approximately 300-500 words
10. Do NOT use markdown syntax, just plain text with double asterisks for section headers
11. Return the text exactly as it should appear to the end user, with no additional formatting

Example:
Input: "create a business card website"
Output: "**Please create a personal 'business card' style website** that showcases my professional identity and work portfolio effectively. The site should function as my digital presence with a clean, modern aesthetic.

**Page Structure & Layout**
Feature a striking hero section with my name/logo prominently displayed, followed by a concise tagline that captures my professional essence. Implement a minimalist navigation system with smooth scrolling to different sections. Create distinct areas for my bio, skills/services, portfolio highlights, and contact information.

**Color & Theme**
Utilize a professional color scheme with 2-3 primary colors that reflect my industry and personal brand. Incorporate subtle background textures or patterns that add visual interest without overwhelming the content. Maintain consistent styling elements throughout to create a cohesive experience.

**Content Components**
Include a brief but compelling personal bio that highlights my expertise and unique value proposition. Feature 3-5 of my best work examples with brief descriptions. Add testimonials or endorsements if available. Present my skills or services using visually appealing icons or graphics.

**Technical Requirements**
Ensure the site is fully responsive across all device sizes with optimized images and assets. Implement subtle animations or transitions that enhance the user experience without feeling excessive. Add SEO-friendly metadata and structure to improve discoverability.

**Interactive Elements**
Include easy-to-find contact options with a simple form or direct email link. Add social media integration with recognizable icons. Consider implementing a downloadable resume/CV option or digital business card feature.

Please compile this into a clean, professional website that effectively represents my personal brand while making it easy for potential clients or employers to understand my value and get in touch."`,
          },
          {
            role: MessageRole.User,
            content: description,
          },
        ],
      });

      this.logger.debug('Enhanced description generated');
      return response;
    } catch (error) {
      this.logger.error(
        `Error generating enhanced description: ${error.message}`,
      );
      throw new Error('Failed to enhance project description');
    }
  }
}
