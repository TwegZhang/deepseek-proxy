export interface VisionProvider {
  readonly name: string;
  describe(imageBase64: string, mediaType: string, prompt?: string): Promise<string>;
}
