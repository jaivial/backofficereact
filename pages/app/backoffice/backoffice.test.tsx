import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("jotai",async(importOriginal)=>{const actual=await importOriginal<typeof import("jotai")>();return{...actual,useAtomValue:()=>({user:{role:"admin",roleImportance:90,sectionAccess:["reservas","menus"],name:"Admin"}})}});
vi.mock("vike-react/usePageContext",()=>({usePageContext:()=>({bo:{session:{user:{role:"admin",roleImportance:90,sectionAccess:["reservas","menus"],name:"Admin"}}}})}));
vi.mock("../../../ui/nav/sectionIcons",()=>({iconForSidebarItemKey:(key:string)=>React.createElement("span",{"data-testid":`icon-${key}`})}));

import Page from "./+Page";

describe("Backoffice home",()=>{
  it("shows stock and POS modules for admin",()=>{
    render(<Page/>);
    expect(screen.getAllByText("Stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TPV").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link",{name:/Stock/})[0]).toHaveAttribute("href","/app/stock");
    expect(screen.getAllByRole("link",{name:/TPV/})[0]).toHaveAttribute("href","/app/pos");
  });
});
