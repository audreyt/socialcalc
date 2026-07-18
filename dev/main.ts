declare global {
  interface Window {
    socialCalcDevControl?: SocialCalc.SpreadsheetControl;
  }
}

const status = (message: string): void => {
  const element = document.getElementById("dev-status");
  if (element) element.textContent = message;
};

$(function initializeDevWorkbench(): void {
  try {
    if (typeof $ !== "function") throw new Error("jQuery is unavailable");
    if (typeof SocialCalc === "undefined" || typeof SocialCalc.SpreadsheetControl !== "function") {
      throw new Error("SocialCalc is unavailable");
    }

    const mount = document.getElementById("dev");
    if (!mount) throw new Error("Spreadsheet mount is missing");

    const header = document.querySelector<HTMLElement>(".dev-header");
    const height = Math.max(0, window.innerHeight - (header?.getBoundingClientRect().height ?? 0));
    const width = Math.max(0, mount.getBoundingClientRect().width);
    const control = new SocialCalc.SpreadsheetControl("dev");
    control.InitializeSpreadsheetControl(mount, height, width, 0);
    SocialCalc.SetSpreadsheetControlObject(control);
    window.socialCalcDevControl = control;
    window.setTimeout(() => control.ExecuteCommand("recalc"), 0);
    status("Ready");
  } catch (error) {
    status("Error loading workbench");
    throw error;
  }
});

export {};
