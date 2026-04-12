import type { Preview } from "@storybook/react";
import React from "react";
import "../components/bo.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#0f0f14" },
        { name: "light", value: "#f8f8f8" },
        { name: "white", value: "#ffffff" },
      ],
    },
    viewport: {
      viewports: {
        desktopXL: {
          name: "Desktop XL",
          styles: { width: "1920px", height: "1080px" },
        },
        desktopLG: {
          name: "Desktop LG",
          styles: { width: "1440px", height: "900px" },
        },
        desktopMD: {
          name: "Desktop MD",
          styles: { width: "1280px", height: "800px" },
        },
        desktopSM: {
          name: "Desktop SM",
          styles: { width: "1024px", height: "768px" },
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
        },
        mobileLG: {
          name: "Mobile LG",
          styles: { width: "428px", height: "926px" },
        },
        mobileMD: {
          name: "Mobile MD",
          styles: { width: "375px", height: "812px" },
        },
        mobileSM: {
          name: "Mobile SM",
          styles: { width: "320px", height: "568px" },
        },
      },
    },
    a11y: {
      config: {
        rules: [
          {
            // Require interactive elements to have accessible names
            id: "aria-required-attr",
            enabled: true,
          },
          {
            // Require images to have alt text
            id: "img-alt",
            enabled: true,
          },
          {
            // Require buttons to have accessible names
            id: "button-name",
            enabled: true,
          },
        ],
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        data-storybook="with-session"
        style={{ backgroundColor: "#0f0f14", padding: "1rem" }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
