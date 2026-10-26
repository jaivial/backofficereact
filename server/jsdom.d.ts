// Minimal typing of the jsdom surface the backoffice server uses (campaign
// design engine and email compiler, campaign_tools_v1): one window whose
// DOMParser and selector engine run the builder's document model.
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
  }
}
