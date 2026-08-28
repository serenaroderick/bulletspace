/**
 * Built-in canvas-background textures (Phase 5.6). Pure CSS repeating
 * patterns -- no image files needed, same zero-asset approach as the
 * emoji sticker pack, and inherently seamless/tileable since CSS
 * background-repeat handles the infinite-panning requirement for free.
 */
export const texturePatterns: Record<string, { backgroundImage: string; backgroundSize?: string }> = {
  "paper-grain": {
    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)",
    backgroundSize: "6px 6px",
  },
  "diagonal-hatch": {
    backgroundImage:
      "repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 8px)",
  },
};

export const builtInTextureIds = Object.keys(texturePatterns);
