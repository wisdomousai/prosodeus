/**
 * Tiptap Extension wrapper for the heat decoration ProseMirror plugin.
 * This is the proper way to register custom ProseMirror plugins in Tiptap.
 */

import { Extension } from "@tiptap/core";
import { createHeatDecorationPlugin } from "./heat-decoration";

export const HeatDecoration = Extension.create({
  name: "heatDecoration",

  addProseMirrorPlugins() {
    return [createHeatDecorationPlugin()];
  },
});
