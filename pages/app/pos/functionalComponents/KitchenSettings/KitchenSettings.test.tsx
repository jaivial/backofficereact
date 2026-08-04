import React from "react";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {KitchenSettings} from "./KitchenSettings";
describe("KitchenSettings",()=>{beforeEach(()=>vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);if(url.endsWith("/kitchen/stations")&&init?.method==="POST")return new Response(JSON.stringify({success:true,id:1}),{status:201});return new Response(JSON.stringify({success:true,items:[],products:[]}))})));it("creates internal KDS station",async()=>{render(<KitchenSettings/>);fireEvent.change(screen.getByLabelText("Nombre estación cocina"),{target:{value:"Caliente"}});fireEvent.click(screen.getByTestId("create-kitchen-station"));await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/admin/pos/kitchen/stations",expect.objectContaining({body:expect.stringContaining('"name":"Caliente"')})))})});
