declare namespace SocialCalc {
    interface FormatNumberSectionInfo {
        sectionstart?: number;
        integerdigits?: number;
        fractiondigits?: number;
        commas?: number;
        percent?: number;
        thousandssep?: number;
        hasdate?: number;
        [key: string]: any;
    }

    interface FormatNumberDefinition {
        operators: number[];
        operands: string[];
        sectioninfo: FormatNumberSectionInfo[];
        hascomparison?: number;
        [key: string]: any;
    }

    interface FormatNumberBracketData {
        operator: number;
        operand: string;
        [key: string]: any;
    }

    interface FormatNumberYMD {
        year: number;
        month: number;
        day: number;
        [key: string]: any;
    }

    interface FormatNumberCommands {
        copy: number;
        color: number;
        integer_placeholder: number;
        fraction_placeholder: number;
        decimal: number;
        currency: number;
        general: number;
        separator: number;
        date: number;
        comparison: number;
        section: number;
        style: number;
        [key: string]: any;
    }

    interface FormatNumberDateValues {
        julian_offset: number;
        seconds_in_a_day: number;
        seconds_in_an_hour: number;
        [key: string]: any;
    }

    namespace FormatNumber {
        const format_definitions: { [format_string: string]: FormatNumberDefinition };

        let separatorchar: string;
        let decimalchar: string;

        const daynames: string[];
        const daynames3: string[];
        const monthnames3: string[];
        const monthnames: string[];

        const allowedcolors: { [name: string]: string };
        const alloweddates: { [name: string]: string };

        const commands: FormatNumberCommands;
        const datevalues: FormatNumberDateValues;

        function formatNumberWithFormat(
            rawvalue: number | string,
            format_string: string,
            currency_char?: string
        ): string;

        function formatTextWithFormat(
            rawvalue: any,
            format_string: string
        ): string;

        function parse_format_string(
            format_defs: { [format_string: string]: FormatNumberDefinition },
            format_string: string
        ): void;

        function parse_format_bracket(bracketstr: string): FormatNumberBracketData;

        function convert_date_gregorian_to_julian(
            year: number,
            month: number,
            day: number
        ): number;

        function convert_date_julian_to_gregorian(juliandate: number): FormatNumberYMD;
    }

    function intFunc(n: number): number;
}
