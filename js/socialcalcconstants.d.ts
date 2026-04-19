declare namespace SocialCalc {
    interface SocialCalcConstantsCellDataType {
        v: string;
        n: string;
        t: string;
        f: string;
        c: string;
        [key: string]: string;
    }

    interface SocialCalcConstants {
        // Cell data type lookup
        cellDataType: SocialCalcConstantsCellDataType;

        // Common constants
        textdatadefaulttype: string;

        // Common error messages
        s_BrowserNotSupported: string;
        s_InternalError: string;

        // SocialCalc.ParseSheetSave
        s_pssUnknownColType: string;
        s_pssUnknownRowType: string;
        s_pssUnknownLineType: string;

        // SocialCalc.CellFromStringParts
        s_cfspUnknownCellType: string;

        // SocialCalc.CanonicalizeSheet
        doCanonicalizeSheet: boolean;

        // ExecuteSheetCommand
        s_escUnknownSheetCmd: string;
        s_escUnknownSetCoordCmd: string;
        s_escUnknownCmd: string;

        // SocialCalc.CheckAndCalcCell
        s_caccCircRef: string;

        // SocialCalc.RenderContext
        defaultRowNameWidth: string;
        defaultAssumedRowHeight: number;
        defaultCellIDPrefix: string;

        // Default sheet display values
        defaultCellLayout: string;
        defaultCellFontStyle: string;
        defaultCellFontSize: string;
        defaultCellFontFamily: string;

        defaultPaneDividerWidth: string;
        defaultPaneDividerHeight: string;

        defaultGridCSS: string;

        defaultCommentClass: string;
        defaultCommentStyle: string;
        defaultCommentNoGridClass: string;
        defaultCommentNoGridStyle: string;

        defaultReadonlyClass: string;
        defaultReadonlyStyle: string;
        defaultReadonlyNoGridClass: string;
        defaultReadonlyNoGridStyle: string;
        defaultReadonlyComment: string;

        defaultColWidth: string;
        defaultMinimumColWidth: number;

        defaultHighlightTypeCursorClass: string;
        defaultHighlightTypeCursorStyle: string;
        defaultHighlightTypeRangeClass: string;
        defaultHighlightTypeRangeStyle: string;

        defaultColnameClass: string;
        defaultColnameStyle: string;
        defaultSelectedColnameClass: string;
        defaultSelectedColnameStyle: string;
        defaultRownameClass: string;
        defaultRownameStyle: string;
        defaultSelectedRownameClass: string;
        defaultSelectedRownameStyle: string;
        defaultUpperLeftClass: string;
        defaultUpperLeftStyle: string;
        defaultSkippedCellClass: string;
        defaultSkippedCellStyle: string;
        defaultPaneDividerClass: string;
        defaultPaneDividerStyle: string;
        defaultUnhideLeftClass: string;
        defaultUnhideLeftStyle: string;
        defaultUnhideRightClass: string;
        defaultUnhideRightStyle: string;
        defaultUnhideTopClass: string;
        defaultUnhideTopStyle: string;
        defaultUnhideBottomClass: string;
        defaultUnhideBottomStyle: string;

        defaultColResizeBarClass: string;
        defaultRowResizeBarClass: string;

        s_rcMissingSheet: string;

        // SocialCalc.format_text_for_display
        defaultLinkFormatString: string;
        defaultPageLinkFormatString: string;

        // SocialCalc.format_number_for_display
        defaultFormatp: string;
        defaultFormatc: string;
        defaultFormatdt: string;
        defaultFormatd: string;
        defaultFormatt: string;
        defaultDisplayTRUE: string;
        defaultDisplayFALSE: string;

        // SocialCalc.TableEditor
        defaultImagePrefix: string;
        defaultTableEditorIDPrefix: string;
        defaultPageUpDnAmount: number;

        AllowCtrlS: boolean;

        // SocialCalc.CreateTableEditor
        defaultTableControlThickness: number;
        cteGriddivClass: string;

        // SocialCalc.EditorGetStatuslineString
        s_statusline_executing: string;
        s_statusline_displaying: string;
        s_statusline_ordering: string;
        s_statusline_calculating: string;
        s_statusline_calculatingls: string;
        s_statusline_doingserverfunc: string;
        s_statusline_incell: string;
        s_statusline_calcstart: string;
        s_statusline_sum: string;
        s_statusline_recalcneeded: string;
        s_statusline_circref: string;
        s_statusline_sendemail: string;

        // SocialCalc.InputBoxDisplayCellContents
        s_inputboxdisplaymultilinetext: string;

        // SocialCalc.InputEcho
        defaultInputEchoClass: string;
        defaultInputEchoStyle: string;
        defaultInputEchoPromptClass: string;
        defaultInputEchoPromptStyle: string;
        defaultInputEchoHintClass: string;
        defaultInputEchoHintStyle: string;

        // SocialCalc.InputEchoText
        ietUnknownFunction: string;

        // SocialCalc.CellHandles
        CH_radius1: number;
        CH_radius2: number;
        s_CHfillAllTooltip: string;
        s_CHfillContentsTooltip: string;
        s_CHmovePasteAllTooltip: string;
        s_CHmovePasteContentsTooltip: string;
        s_CHmoveInsertAllTooltip: string;
        s_CHmoveInsertContentsTooltip: string;
        s_CHindicatorOperationLookup: Record<string, string>;
        s_CHindicatorDirectionLookup: Record<string, string>;

        // SocialCalc.TableControl
        defaultTCSliderThickness: number;
        defaultTCButtonThickness: number;
        defaultTCThumbThickness: number;

        // SocialCalc.CreateTableControl
        TCmainStyle: string;
        TCmainClass: string;
        TCendcapStyle: string;
        TCendcapClass: string;
        TCpanesliderClass: string;
        s_panesliderTooltiph: string;
        s_panesliderTooltipv: string;
        TClessbuttonStyle: string;
        TClessbuttonClass: string;
        TClessbuttonRepeatWait: number;
        TClessbuttonRepeatInterval: number;
        TCmorebuttonStyle: string;
        TCmorebuttonClass: string;
        TCmorebuttonRepeatWait: number;
        TCmorebuttonRepeatInterval: number;
        TCscrollareaStyle: string;
        TCscrollareaClass: string;
        TCscrollareaRepeatWait: number;
        TCscrollareaRepeatInterval: number;
        TCthumbClass: string;
        TCthumbStyle: string;

        // SocialCalc.TCPSDragFunctionStart
        TCPStrackinglineClass: string;
        TCPStrackinglineStyle: string;
        TCPStrackinglineThickness: string;

        // SocialCalc.TCTDragFunctionStart
        TCTDFSthumbstatusvClass: string;
        TCTDFSthumbstatusvStyle: string;
        TCTDFSthumbstatushClass: string;
        TCTDFSthumbstatushStyle: string;
        TCTDFSthumbstatusrownumClass: string;
        TCTDFSthumbstatusrownumStyle: string;
        TCTDFStopOffsetv: number;
        TCTDFSleftOffsetv: number;
        s_TCTDFthumbstatusPrefixv: string;
        TCTDFStopOffseth: number;
        TCTDFSleftOffseth: number;
        s_TCTDFthumbstatusPrefixh: string;

        // SocialCalc.TooltipInfo
        TooltipOffsetX: number;
        TooltipOffsetY: number;

        // SocialCalc.TooltipDisplay
        TDpopupElementClass: string;
        TDpopupElementStyle: string;

        // SocialCalc.SpreadsheetControl
        SCToolbarbackground: string;
        SCTabbackground: string;
        SCTabselectedCSS: string;
        SCTabplainCSS: string;
        SCToolbartext: string;

        SCFormulabarheight: number;

        SCStatuslineheight: number;
        SCStatuslineCSS: string;

        // Format tab settings
        SCFormatNumberFormats: string;
        SCFormatTextFormats: string;
        SCFormatPadsizes: string;
        SCFormatFontsizes: string;
        SCFormatFontfamilies: string;
        SCFormatFontlook: string;
        SCFormatTextAlignhoriz: string;
        SCFormatNumberAlignhoriz: string;
        SCFormatAlignVertical: string;
        SCFormatColwidth: string;
        SCFormatRecalc: string;
        SCFormatUserMaxCol: string;
        SCFormatUserMaxRow: string;

        // SocialCalc.InitializeSpreadsheetControl
        ISCButtonNormalBackground: string;
        ISCButtonBorderNormal: string;
        ISCButtonBorderHover: string;
        ISCButtonBorderDown: string;
        ISCButtonDownBackground: string;

        // SocialCalc.SettingsControls.PopupListInitialize
        s_PopupListCancel: string;
        s_PopupListCustom: string;

        // Localization strings (s_loc_*)
        s_loc_align_center: string;
        s_loc_align_left: string;
        s_loc_align_right: string;
        s_loc_alignment: string;
        s_loc_audit: string;
        s_loc_audit_trail_this_session: string;
        s_loc_auto: string;
        s_loc_auto_sum: string;
        s_loc_auto_wX_commas: string;
        s_loc_automatic: string;
        s_loc_background: string;
        s_loc_bold: string;
        s_loc_bold_XampX_italics: string;
        s_loc_bold_italic: string;
        s_loc_borders: string;
        s_loc_borders_off: string;
        s_loc_borders_on: string;
        s_loc_bottom: string;
        s_loc_bottom_border: string;
        s_loc_cell_settings: string;
        s_loc_csv_format: string;
        s_loc_cancel: string;
        s_loc_category: string;
        s_loc_center: string;
        s_loc_clear: string;
        s_loc_clear_socialcalc_clipboard: string;
        s_loc_clipboard: string;
        s_loc_color: string;
        s_loc_column_: string;
        s_loc_comment: string;
        s_loc_copy: string;
        s_loc_custom: string;
        s_loc_cut: string;
        s_loc_default: string;
        s_loc_default_alignment: string;
        s_loc_default_column_width: string;
        s_loc_default_font: string;
        s_loc_default_format: string;
        s_loc_default_padding: string;
        s_loc_delete: string;
        s_loc_delete_column: string;
        s_loc_delete_contents: string;
        s_loc_delete_row: string;
        s_loc_description: string;
        s_loc_display_clipboard_in: string;
        s_loc_down: string;
        s_loc_edit: string;
        s_loc_existing_names: string;
        s_loc_family: string;
        s_loc_fill_down: string;
        s_loc_fill_right: string;
        s_loc_font: string;
        s_loc_format: string;
        s_loc_formula: string;
        s_loc_function_list: string;
        s_loc_functions: string;
        s_loc_grid: string;
        s_loc_hidden: string;
        s_loc_hide_column: string;
        s_loc_hide_row: string;
        s_loc_horizontal: string;
        s_loc_insert_column: string;
        s_loc_insert_row: string;
        s_loc_italic: string;
        s_loc_last_sort: string;
        s_loc_left: string;
        s_loc_left_border: string;
        s_loc_link: string;
        s_loc_link_input_box: string;
        s_loc_list: string;
        s_loc_load_socialcalc_clipboard_with_this: string;
        s_loc_lock_cell: string;
        s_loc_major_sort: string;
        s_loc_manual: string;
        s_loc_merge_cells: string;
        s_loc_middle: string;
        s_loc_minor_sort: string;
        s_loc_move_insert: string;
        s_loc_move_paste: string;
        s_loc_multiXline_input_box: string;
        s_loc_name: string;
        s_loc_names: string;
        s_loc_no_padding: string;
        s_loc_normal: string;
        s_loc_number: string;
        s_loc_number_horizontal: string;
        s_loc_ok: string;
        s_loc_padding: string;
        s_loc_page_name: string;
        s_loc_paste: string;
        s_loc_paste_formats: string;
        s_loc_plain_text: string;
        s_loc_recalc: string;
        s_loc_recalculation: string;
        s_loc_redo: string;
        s_loc_right: string;
        s_loc_right_border: string;
        s_loc_sheet_settings: string;
        s_loc_save: string;
        s_loc_save_to: string;
        s_loc_set_cell_contents: string;
        s_loc_set_cells_to_sort: string;
        s_loc_set_value_to: string;
        s_loc_set_to_link_format: string;
        s_loc_setXclear_move_from: string;
        s_loc_show_cell_settings: string;
        s_loc_show_sheet_settings: string;
        s_loc_show_in_new_browser_window: string;
        s_loc_size: string;
        s_loc_socialcalcXsave_format: string;
        s_loc_sort: string;
        s_loc_sort_: string;
        s_loc_sort_cells: string;
        s_loc_swap_colors: string;
        s_loc_tabXdelimited_format: string;
        s_loc_text: string;
        s_loc_text_horizontal: string;
        s_loc_this_is_aXbrXsample: string;
        s_loc_top: string;
        s_loc_top_border: string;
        s_loc_undone_steps: string;
        s_loc_url: string;
        s_loc_undo: string;
        s_loc_unlock_cell: string;
        s_loc_unmerge_cells: string;
        s_loc_up: string;
        s_loc_value: string;
        s_loc_vertical: string;
        s_loc_wikitext: string;
        s_loc_workspace: string;
        s_loc_XnewX: string;
        s_loc_XnoneX: string;
        s_loc_Xselect_rangeX: string;

        // SocialCalc.SpreadsheetViewer
        SVStatuslineheight: number;
        SVStatuslineCSS: string;

        // SocialCalc Format Number module
        FormatNumber_separatorchar: string;
        FormatNumber_decimalchar: string;
        FormatNumber_defaultCurrency: string;

        s_FormatNumber_daynames: string[];
        s_FormatNumber_daynames3: string[];
        s_FormatNumber_monthnames: string[];
        s_FormatNumber_monthnames3: string[];
        s_FormatNumber_am: string;
        s_FormatNumber_am1: string;
        s_FormatNumber_pm: string;
        s_FormatNumber_pm1: string;

        // Formula parse and calc errors
        s_parseerrexponent: string;
        s_parseerrchar: string;
        s_parseerrstring: string;
        s_parseerrspecialvalue: string;
        s_parseerrtwoops: string;
        s_parseerrmissingopenparen: string;
        s_parseerrcloseparennoopen: string;
        s_parseerrmissingcloseparen: string;
        s_parseerrmissingoperand: string;
        s_parseerrerrorinformula: string;
        s_calcerrerrorvalueinformula: string;
        s_parseerrerrorinformulabadval: string;
        s_formularangeresult: string;
        s_calcerrnumericnan: string;
        s_calcerrnumericoverflow: string;
        s_sheetunavailable: string;
        s_calcerrcellrefmissing: string;
        s_calcerrsheetnamemissing: string;
        s_circularnameref: string;
        s_calcerrunknownname: string;
        s_calcerrincorrectargstofunction: string;
        s_sheetfuncunknownfunction: string;
        s_sheetfunclnarg: string;
        s_sheetfunclog10arg: string;
        s_sheetfunclogsecondarg: string;
        s_sheetfunclogfirstarg: string;
        s_sheetfuncroundsecondarg: string;
        s_sheetfuncddblife: string;
        s_sheetfuncslnlife: string;

        // Function definition text
        s_fdef_ABS: string;
        s_fdef_ACOS: string;
        s_fdef_AND: string;
        s_fdef_ASIN: string;
        s_fdef_ATAN: string;
        s_fdef_ATAN2: string;
        s_fdef_AVERAGE: string;
        s_fdef_CHOOSE: string;
        s_fdef_COLUMNS: string;
        s_fdef_COS: string;
        s_fdef_CONCAT: string;
        s_fdef_CONCATENATE: string;
        s_fdef_COUNT: string;
        s_fdef_COUNTA: string;
        s_fdef_COUNTBLANK: string;
        s_fdef_COUNTIF: string;
        s_fdef_DATE: string;
        s_fdef_DAVERAGE: string;
        s_fdef_DAY: string;
        s_fdef_DCOUNT: string;
        s_fdef_DCOUNTA: string;
        s_fdef_DDB: string;
        s_fdef_DEGREES: string;
        s_fdef_DGET: string;
        s_fdef_DMAX: string;
        s_fdef_DMIN: string;
        s_fdef_DPRODUCT: string;
        s_fdef_DSTDEV: string;
        s_fdef_DSTDEVP: string;
        s_fdef_DSUM: string;
        s_fdef_DVAR: string;
        s_fdef_DVARP: string;
        s_fdef_EVEN: string;
        s_fdef_EXACT: string;
        s_fdef_EXP: string;
        s_fdef_FACT: string;
        s_fdef_FALSE: string;
        s_fdef_FIND: string;
        s_fdef_FV: string;
        s_fdef_HLOOKUP: string;
        s_fdef_HOUR: string;
        s_fdef_IF: string;
        s_fdef_INDEX: string;
        s_fdef_INT: string;
        s_fdef_IRR: string;
        s_fdef_ISBLANK: string;
        s_fdef_ISERR: string;
        s_fdef_ISERROR: string;
        s_fdef_ISLOGICAL: string;
        s_fdef_ISNA: string;
        s_fdef_ISNONTEXT: string;
        s_fdef_ISNUMBER: string;
        s_fdef_ISTEXT: string;
        s_fdef_LEFT: string;
        s_fdef_LEN: string;
        s_fdef_LN: string;
        s_fdef_LOG: string;
        s_fdef_LOG10: string;
        s_fdef_LOWER: string;
        s_fdef_MATCH: string;
        s_fdef_MAX: string;
        s_fdef_MID: string;
        s_fdef_MIN: string;
        s_fdef_MINUTE: string;
        s_fdef_MOD: string;
        s_fdef_MONTH: string;
        s_fdef_N: string;
        s_fdef_NA: string;
        s_fdef_NOT: string;
        s_fdef_NOW: string;
        s_fdef_NPER: string;
        s_fdef_NPV: string;
        s_fdef_ODD: string;
        s_fdef_OR: string;
        s_fdef_PI: string;
        s_fdef_PMT: string;
        s_fdef_POWER: string;
        s_fdef_PRODUCT: string;
        s_fdef_PROPER: string;
        s_fdef_PV: string;
        s_fdef_RADIANS: string;
        s_fdef_RATE: string;
        s_fdef_REPLACE: string;
        s_fdef_REPT: string;
        s_fdef_RIGHT: string;
        s_fdef_ROUND: string;
        s_fdef_ROWS: string;
        s_fdef_SECOND: string;
        s_fdef_SIN: string;
        s_fdef_SLN: string;
        s_fdef_SQRT: string;
        s_fdef_STDEV: string;
        s_fdef_STDEVP: string;
        s_fdef_SUBSTITUTE: string;
        s_fdef_SUM: string;
        s_fdef_SUMIF: string;
        s_fdef_SUMIFS: string;
        s_fdef_SYD: string;
        s_fdef_T: string;
        s_fdef_TAN: string;
        s_fdef_TIME: string;
        s_fdef_TODAY: string;
        s_fdef_TRIM: string;
        s_fdef_TRUE: string;
        s_fdef_TRUNC: string;
        s_fdef_UPPER: string;
        s_fdef_VALUE: string;
        s_fdef_VAR: string;
        s_fdef_VARP: string;
        s_fdef_VLOOKUP: string;
        s_fdef_WEEKDAY: string;
        s_fdef_YEAR: string;
        s_fdef_SUMPRODUCT: string;
        s_fdef_CEILING: string;
        s_fdef_FLOOR: string;

        // Function argument signatures
        s_farg_v: string;
        s_farg_vn: string;
        s_farg_xy: string;
        s_farg_choose: string;
        s_farg_range: string;
        s_farg_rangec: string;
        s_farg_date: string;
        s_farg_dfunc: string;
        s_farg_ddb: string;
        s_farg_find: string;
        s_farg_fv: string;
        s_farg_hlookup: string;
        s_farg_iffunc: string;
        s_farg_index: string;
        s_farg_irr: string;
        s_farg_tc: string;
        s_farg_log: string;
        s_farg_match: string;
        s_farg_mid: string;
        s_farg_nper: string;
        s_farg_npv: string;
        s_farg_pmt: string;
        s_farg_pv: string;
        s_farg_rate: string;
        s_farg_replace: string;
        s_farg_vp: string;
        s_farg_valpre: string;
        s_farg_csl: string;
        s_farg_cslp: string;
        s_farg_subs: string;
        s_farg_sumif: string;
        s_farg_hms: string;
        s_farg_txt: string;
        s_farg_vlookup: string;
        s_farg_weekday: string;
        s_farg_dt: string;
        s_farg_rangen: string;
        s_farg_vsig: string;

        // Function class list and labels
        function_classlist: string[];
        s_fclass_all: string;
        s_fclass_stat: string;
        s_fclass_lookup: string;
        s_fclass_datetime: string;
        s_fclass_financial: string;
        s_fclass_test: string;
        s_fclass_math: string;
        s_fclass_text: string;
        s_fclass_action: string;
        s_fclass_gui: string;

        lastone: any;

        [key: string]: any;
    }

    interface SocialCalcConstantsDefaultClassesInputEcho {
        classname: string;
        style: string;
    }

    interface SocialCalcConstantsDefaultClasses {
        defaultComment: string;
        defaultCommentNoGrid: string;
        defaultHighlightTypeCursor: string;
        defaultHighlightTypeRange: string;
        defaultColname: string;
        defaultSelectedColname: string;
        defaultRowname: string;
        defaultSelectedRowname: string;
        defaultUpperLeft: string;
        defaultSkippedCell: string;
        defaultPaneDivider: string;
        cteGriddiv: string;
        defaultInputEcho: SocialCalcConstantsDefaultClassesInputEcho;
        TCmain: string;
        TCendcap: string;
        TCpaneslider: string;
        TClessbutton: string;
        TCmorebutton: string;
        TCscrollarea: string;
        TCthumb: string;
        TCPStrackingline: string;
        TCTDFSthumbstatus: string;
        TDpopupElement: string;
        [key: string]: any;
    }

    const Constants: SocialCalcConstants;
    const ConstantsDefaultClasses: SocialCalcConstantsDefaultClasses;

    function ConstantsSetClasses(prefix?: string): void;
    function ConstantsSetImagePrefix(imagePrefix: string): void;
}
