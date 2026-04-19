declare namespace SocialCalc {

   namespace Popup {

      type PopupControlValue = string | number | { def: boolean; val: any };

      interface PopupTypeHandler {
         Create?: (type: string, id: string, attribs?: PopupAttribs) => void;
         Initialize?: (type: string, id: string, data: any) => void;
         SetValue?: (type: string, id: string, value: PopupControlValue) => void;
         GetValue?: (type: string, id: string) => any;
         SetDisabled?: (type: string, id: string, disabled: boolean) => void;
         Show?: (type: string, id: string) => void;
         Hide?: (type: string, id: string) => void;
         Cancel?: (type: string, id: string) => void;
         Reset?: (type: string) => void;
         [k: string]: any;
      }

      interface PopupControl {
         type: string;
         value: any;
         display?: string;
         data: { [k: string]: any };
         [k: string]: any;
      }

      interface PopupCurrent {
         id: string | null;
         [k: string]: any;
      }

      interface PopupAttribs {
         title?: string;
         moveable?: boolean;
         width?: string;
         ensureWithin?: HTMLElement | null;
         changedcallback?: (attribs: PopupAttribs & { panelobj?: any }, id: string, newvalue: any) => void;
         sampleWidth?: string;
         sampleHeight?: string;
         backgroundImage?: string;
         backgroundImageDefault?: string;
         backgroundImageDisabled?: string;
         [k: string]: any;
      }

      interface PopupLayoutValues {
         top: number;
         left: number;
         height: number;
         width: number;
         bottom: number;
         right: number;
      }

      interface RGBParts {
         r: number;
         g: number;
         b: number;
      }

      const Types: Record<string, PopupTypeHandler>;
      const Controls: Record<string, PopupControl>;
      const Current: PopupCurrent;
      let imagePrefix: string;
      const HexDigits: string;

      function LocalizeString(str: string): string;

      function Create(type: "List" | "ColorChooser" | string, id: string, attribs?: PopupAttribs): void;
      function SetValue(id: string, value: PopupControlValue): void;
      function SetDisabled(id: string, disabled: boolean): void;
      function GetValue(id: string): any;
      function Initialize(id: string, data: any): void;
      function Reset(type: "List" | "ColorChooser" | string): void;
      function CClick(id: string): void;
      function Close(): void;
      function Cancel(): void;

      function CreatePopupDiv(id: string, attribs: PopupAttribs): HTMLElement;
      function EnsurePosition(id: string, container: HTMLElement): void;
      function DestroyPopupDiv(ele: HTMLElement | null, dragregistered: HTMLElement | null): void;

      function RGBToHex(val: string): string;
      function ToHex(num: number): string;
      function FromHex(str: string): number;
      function HexToRGB(val: string): string;
      function makeRGB(r: number, g: number, b: number): string;
      function splitRGB(rgb: string): RGBParts;

      namespace Types {

         const List: PopupTypeHandler & {
            Create: (type: string, id: string, attribs?: PopupAttribs) => void;
            SetValue: (type: string, id: string, value: PopupControlValue) => void;
            SetDisabled: (type: string, id: string, disabled: boolean) => void;
            GetValue: (type: string, id: string) => any;
            Initialize: (type: string, id: string, data: any) => void;
            Reset: (type: string) => void;
            Show: (type: string, id: string) => void;
            Hide: (type: string, id: string) => void;
            Cancel: (type: string, id: string) => void;
            MakeList: (type: string, id: string) => string;
            MakeCustom: (type: string, id: string) => string;
            ItemClicked: (id: string, num: number | string) => void;
            CustomToList: (id: string) => void;
            CustomOK: (id: string) => void;
            MouseMove: (id: string, ele: HTMLElement) => void;
         };

         const ColorChooser: PopupTypeHandler & {
            Create: (type: string, id: string, attribs?: PopupAttribs) => void;
            SetValue: (type: string, id: string, value: PopupControlValue) => void;
            SetDisabled: (type: string, id: string, disabled: boolean) => void;
            GetValue: (type: string, id: string) => any;
            Initialize: (type: string, id: string, data: any) => void;
            Reset: (type: string) => void;
            Show: (type: string, id: string) => void;
            Hide: (type: string, id: string) => void;
            Cancel: (type: string, id: string) => void;
            MakeCustom: (type: string, id: string) => string;
            ItemClicked: (id: string, num: number | string) => void;
            CustomToList: (id: string) => void;
            CustomToGrid: (id: string) => void;
            CustomOK: (id: string) => void;
            CreateGrid: (type: string, id: string) => HTMLElement;
            gridToG: (grid: HTMLElement, row: number, col: number) => any;
            DetermineColors: (id: string) => void;
            SetColors: (id: string) => void;
            GridMouseDown: (e: MouseEvent | Event) => void;
            ControlClicked: (id: string) => void;
            DefaultClicked: (e: MouseEvent | Event) => void;
            CustomClicked: (e: MouseEvent | Event) => void;
            CloseOK: (e?: MouseEvent | Event) => void;
         };

      }

   }

}
