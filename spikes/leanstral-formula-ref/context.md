# Leanstral formula reference rewrite — local context

## js/socialcalc-3.js — rewrite functions (3663-3875)

```
3663:// updatedformula = SocialCalc.OffsetFormulaCoords(formula, coloffset, rowoffset)
3664://
3665:// Change relative cell references by offsets (even those to other worksheets so fill, paste, sort work as expected).
3666:// If not what you want, use absolute references.
3667://
3668:
3669:/** @param {any} formula @param {any} coloffset @param {any} rowoffset */
3670:SocialCalc.OffsetFormulaCoords = function(formula, coloffset, rowoffset) {
3671:
3672:   var parseinfo, ttext, ttype, i, cr, newcr;
3673:   var updatedformula = "";
3674:   var scf = SocialCalc.Formula;
3675:   // The !scf defensive guard was removed — formula1.js is always
3676:   // concatenated into the bundle, so SocialCalc.Formula is guaranteed.
3677:   var tokentype = scf.TokenType;
3678:   var token_op = tokentype.op;
3679:   var token_string = tokentype.string;
3680:   var token_coord = tokentype.coord;
3681:   var tokenOpExpansion = scf.TokenOpExpansion;
3682:
3683:   parseinfo = scf.ParseFormulaIntoTokens(formula);
3684:
3685:   for (i=0; i<parseinfo.length; i++) {
3686:      ttype = parseinfo[i].type;
3687:      ttext = parseinfo[i].text;
3688:      if (ttype == token_coord) {
3689:         newcr = "";
3690:         cr = SocialCalc.coordToCr(ttext);
3691:         if (ttext.charAt(0)!="$") { // add col offset unless absolute column
3692:            cr.col += coloffset;
3693:            }
3694:         else {
3695:            newcr += "$";
3696:            }
3697:         newcr += SocialCalc.rcColname(cr.col);
3698:         if (ttext.indexOf("$", 1)==-1) { // add row offset unless absolute row
3699:            cr.row += rowoffset;
3700:            }
3701:         else {
3702:            newcr += "$";
3703:            }
3704:         newcr += cr.row;
3705:         if (cr.row < 1 || cr.col < 1) {
3706:            newcr = "#REF!";
3707:            }
3708:         updatedformula += newcr;
3709:         }
3710:      else if (ttype == token_string) {
3711:         if (ttext.indexOf('"') >= 0) { // quotes to double
3712:            updatedformula += '"' + ttext.replace(/"/g, '""') + '"';
3713:            }
3714:         else updatedformula += '"' + ttext + '"';
3715:         }
3716:      else if (ttype == token_op) {
3717:         updatedformula += tokenOpExpansion[ttext] || ttext; // make sure short tokens (e.g., "G") go back full (">=")
3718:         }
3719:      else { // leave everything else alone
3720:         updatedformula += ttext;
3721:         }
3722:      }
3723:
3724:   return updatedformula;
3725:
3726:   }
3727:
3728://
3729:// updatedformula = SocialCalc.AdjustFormulaCoords(formula, col, coloffset, row, rowoffset)
3730://
3731:// Change all cell references to cells starting with col/row by offsets
3732://
3733:
3734:/** @param {any} formula @param {any} col @param {any} coloffset @param {any} row @param {any} rowoffset */
3735:SocialCalc.AdjustFormulaCoords = function(formula, col, coloffset, row, rowoffset) {
3736:
3737:   var ttype, ttext, i, newcr, cr, parseinfo;
3738:   var updatedformula = "";
3739:   var sheetref = false;
3740:   var scf = SocialCalc.Formula;
3741:   // The !scf defensive guard was removed — formula1.js is always
3742:   // concatenated into the bundle, so SocialCalc.Formula is guaranteed.
3743:   var tokentype = scf.TokenType;
3744:   var token_op = tokentype.op;
3745:   var token_string = tokentype.string;
3746:   var token_coord = tokentype.coord;
3747:   var tokenOpExpansion = scf.TokenOpExpansion;
3748:
3749:   parseinfo = SocialCalc.Formula.ParseFormulaIntoTokens(formula);
3750:
3751:   for (i=0; i<parseinfo.length; i++) {
3752:      ttype = parseinfo[i].type;
3753:      ttext = parseinfo[i].text;
3754:      if (ttype == token_op) { // references with sheet specifier are not offset
3755:         if (ttext == "!") {
3756:            sheetref = true; // found a sheet reference
3757:            }
3758:         else if (ttext != ":") { // for everything but a range, reset
3759:            sheetref = false;
3760:            }
3761:         ttext = tokenOpExpansion[ttext] || ttext; // make sure short tokens (e.g., "G") go back full (">=")
3762:         }
3763:      if (ttype == token_coord) {
3764:         cr = SocialCalc.coordToCr(ttext);
3765:         if ((coloffset < 0 && cr.col >= col && cr.col < col-coloffset) ||
3766:             (rowoffset < 0 && cr.row >= row && cr.row < row-rowoffset)) { // refs to deleted cells become invalid
3767:            if (!sheetref) {
3768:               cr.col = 0;
3769:               cr.row = 0;
3770:               }
3771:            }
3772:         if (!sheetref) {
3773:            if (cr.col >= col) {
3774:               cr.col += coloffset;
3775:               }
3776:            if (cr.row >= row) {
3777:               cr.row += rowoffset;
3778:               }
3779:            }
3780:         if (ttext.charAt(0)=="$") {
3781:            newcr = "$"+SocialCalc.rcColname(cr.col);
3782:            }
3783:         else {
3784:            newcr = SocialCalc.rcColname(cr.col);
3785:            }
3786:         if (ttext.indexOf("$", 1)!=-1) {
3787:            newcr += "$" + cr.row;
3788:            }
3789:         else {
3790:            newcr += cr.row;
3791:            }
3792:         if (cr.row < 1 || cr.col < 1) {
3793:            newcr = "#REF!";
3794:            }
3795:         ttext = newcr;
3796:         }
3797:      else if (ttype == token_string) {
3798:         ttext = '"' + (ttext.indexOf('"') >= 0 ? ttext.replace(/"/g, '""') : ttext) + '"';
3799:         }
3800:      updatedformula += ttext;
3801:      }
3802:
3803:   return updatedformula;
3804:
3805:   }
3806:
3807://
3808:// updatedformula = SocialCalc.ReplaceFormulaCoords(formula, movedto)
3809://
3810:// Change all cell references to cells that are keys in moveto to be to moveto[coord].
3811:// Don't change references to other sheets.
3812:// Handle range extents specially.
3813://
3814:
3815:/** @param {any} formula @param {any} movedto */
3816:SocialCalc.ReplaceFormulaCoords = function(formula, movedto) {
3817:
3818:   var ttype, ttext, i, newcr, coord, cr, parseinfo;
3819:   var updatedformula = "";
3820:   var sheetref = false;
3821:   var scf = SocialCalc.Formula;
3822:   // The !scf defensive guard was removed — formula1.js is always
3823:   // concatenated into the bundle, so SocialCalc.Formula is guaranteed.
3824:   var tokentype = scf.TokenType;
3825:   var token_op = tokentype.op;
3826:   var token_string = tokentype.string;
3827:   var token_coord = tokentype.coord;
3828:   var tokenOpExpansion = scf.TokenOpExpansion;
3829:
3830:   parseinfo = SocialCalc.Formula.ParseFormulaIntoTokens(formula);
3831:
3832:   for (i=0; i<parseinfo.length; i++) {
3833:      ttype = parseinfo[i].type;
3834:      ttext = parseinfo[i].text;
3835:      if (ttype == token_op) { // references with sheet specifier are not change
3836:         if (ttext == "!") {
3837:            sheetref = true; // found a sheet reference
3838:            }
3839:         else if (ttext != ":") { // for everything but a range, reset
3840:            sheetref = false;
3841:            }
3842:
3843://!!!! HANDLE RANGE EXTENT MOVES
3844:
3845:         ttext = tokenOpExpansion[ttext] || ttext; // make sure short tokens (e.g., "G") go back full (">=")
3846:         }
3847:      if (ttype == token_coord) {
3848:         cr = SocialCalc.coordToCr(ttext); // get parts
3849:         coord = SocialCalc.crToCoord(cr.col, cr.row); // get "clean" reference
3850:         if (movedto[coord] && !sheetref) { // this is a reference to a moved cell
3851:            cr = SocialCalc.coordToCr(movedto[coord]); // get new row and col
3852:            if (ttext.charAt(0)=="$") { // copy absolute ref marks if present
3853:               newcr = "$"+SocialCalc.rcColname(cr.col);
3854:               }
3855:            else {
3856:               newcr = SocialCalc.rcColname(cr.col);
3857:               }
3858:            if (ttext.indexOf("$", 1)!=-1) {
3859:               newcr += "$" + cr.row;
3860:               }
3861:            else {
3862:               newcr += cr.row;
3863:               }
3864:            ttext = newcr;
3865:            }
3866:         }
3867:      else if (ttype == token_string) {
3868:         ttext = '"' + (ttext.indexOf('"') >= 0 ? ttext.replace(/"/g, '""') : ttext) + '"';
3869:         }
3870:      updatedformula += ttext;
3871:      }
3872:
3873:   return updatedformula;
3874:
3875:   }
```

## js/socialcalc-3.js — filldown/fillright callsite (2386-2503)

```
2386:      case "fillright":
2387:      case "filldown":
2388:         sheet.renderneeded = true;
2389:         sheet.changedrendervalues = true;
2390:         if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans
2391:         what = cmd.NextToken();
2392:         rest = cmd.RestOfString();
2393:         ParseRange();
2394:         /** @param {boolean} down */
2395:         function increment_amount(down) {
2396:            /** @param {string | null | undefined} type */
2397:            function valid_datatype(type) {
2398:		return type == "v" || type == "c";
2399:            }
2400:            /** @param {any} startcell @param {any} endcell */
2401:            function increment_from_cells(startcell, endcell) {
2402:               if (valid_datatype(startcell.datatype) && valid_datatype(endcell.datatype)) {
2403:                  return endcell.datavalue - startcell.datavalue;
2404:                  }
2405:               return undefined;
2406:               }
2407:            var csco = SocialCalc.GetSpreadsheetControlObject();
2408:            var editor = csco && csco.editor;
2409:            var range = editor && editor.range2;
2410:            var returnval = undefined;
2411:            var startcell, endcell;
2412:            if (range && range.hasrange) {
2413:                if (down && (range.bottom - range.top == 1) && range.left == range.right) {
2414:                  startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(range.left, range.top));
2415:                  endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(range.left, range.bottom));
2416:                  returnval = increment_from_cells(startcell, endcell);
2417:                } else if (!down && range.left != range.right) {
2418:                  startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(range.left, range.top));
2419:                  endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(range.right, range.top));
2420:                  returnval = increment_from_cells(startcell, endcell);
2421:		  }
2422:                }
2423:            if (returnval === undefined) {
2424:               // Fall back to the command range so filldown/fillright replay on the
2425:               // server (no editor.range2) still compute increments from the first
2426:               // two source cells in the fill direction.
2427:               if (down && cr2.row > cr1.row && cr1.col == cr2.col) {
2428:                  startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(cr1.col, cr1.row));
2429:                  endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(cr1.col, cr1.row + 1));
2430:                  returnval = increment_from_cells(startcell, endcell);
2431:                  }
2432:               else if (!down && cr2.col > cr1.col && cr1.row == cr2.row) {
2433:                  startcell = sheet.GetAssuredCell(SocialCalc.crToCoord(cr1.col, cr1.row));
2434:                  endcell = sheet.GetAssuredCell(SocialCalc.crToCoord(cr1.col + 1, cr1.row));
2435:                  returnval = increment_from_cells(startcell, endcell);
2436:                  }
2437:               }
2438:            if (editor) editor.Range2Remove();
2439:           return returnval;
2440:         }
2441:	 var inc;
2442:         if (cmd1 == "fillright") {
2443:            fillright = true;
2444:            rowstart = cr1.row;
2445:            colstart = cr1.col + 1;
2446:	    inc = increment_amount(false);
2447:            }
2448:         else {
2449:            fillright = false;
2450:            rowstart = cr1.row + 1;
2451:            colstart = cr1.col;
2452:	    inc = increment_amount(true);
2453:            }
2454:         for (row = rowstart; row <= cr2.row; row++) {
2455:            for (col = colstart; col <= cr2.col; col++) {
2456:               cr = SocialCalc.crToCoord(col, row);
2457:               cell=sheet.GetAssuredCell(cr);
2458:               if (cell.readonly) continue;
2459:               if (saveundo) changes.AddUndo("set "+cr+" all", sheet.CellToString(cell));
2460:               if (fillright) {
2461:                  crbase = SocialCalc.crToCoord(cr1.col, row);
2462:                  coloffset = col - colstart + 1;
2463:                  rowoffset = 0;
2464:                  }
2465:               else {
2466:                  crbase = SocialCalc.crToCoord(col, cr1.row);
2467:                  coloffset = 0;
2468:                  rowoffset = row - rowstart + 1;
2469:                  }
2470:               basecell = sheet.GetAssuredCell(crbase);
2471:               if (rest == "all" || rest == "formats") {
2472:                  for (attrib in cellProperties) {
2473:                     if (cellProperties[attrib] == 1) continue; // copy only format attributes
2474:                     if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
2475:                        delete cell[attrib];
2476:                        }
2477:                     else {
2478:                        cell[attrib] = basecell[attrib];
2479:                        }
2480:                     }
2481:                  }
2482:               if (rest == "all" || rest == "formulas") {
2483:                  if (inc !== undefined) {
2484:                      cell.datavalue = basecell.datavalue + (fillright ? coloffset : rowoffset)*inc;
2485:                  } else {
2486:                      cell.datavalue = basecell.datavalue;
2487:                  }
2488:                  cell.datatype = basecell.datatype;
2489:                  cell.valuetype = basecell.valuetype;
2490:                  if (cell.datatype == "f") { // offset relative coords, even in sheet references
2491:                     cell.formula = SocialCalc.OffsetFormulaCoords(basecell.formula, coloffset, rowoffset);
2492:                     }
2493:                  else {
2494:                     cell.formula = basecell.formula;
2495:                     }
2496:                  delete cell.parseinfo;
2497:                  cell.errors = basecell.errors;
2498:                  }
2499:               delete cell.displaystring;
2500:               }
2501:            }
2502:
2503:         attribs.needsrecalc = "yes";
```

## js/socialcalc-3.js — paste callsite (2524-2604)

```
2524:      case "paste":
2525:         sheet.renderneeded = true;
2526:         sheet.changedrendervalues = true;
2527:         if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans
2528:         what = cmd.NextToken();
2529:         rest = cmd.RestOfString();
2530:         ParseRange();
2531:         if (!SocialCalc.Clipboard.clipboard) {
2532:            break;
2533:            }
2534:         clipsheet = new SocialCalc.Sheet(); // load clipboard contents as another sheet
2535:         clipsheet.ParseSheetSave(SocialCalc.Clipboard.clipboard);
2536:         cliprange = SocialCalc.ParseRange(clipsheet.copiedfrom);
2537:         numcols = Math.max(cr2.col - cr1.col + 1, cliprange.cr2.col - cliprange.cr1.col + 1);
2538:         numrows = Math.max(cr2.row - cr1.row + 1, cliprange.cr2.row - cliprange.cr1.row + 1);
2539:         if (cr1.col+numcols-1 > attribs.lastcol) attribs.lastcol = cr1.col+numcols-1;
2540:         if (cr1.row+numrows-1 > attribs.lastrow) attribs.lastrow = cr1.row+numrows-1;
2541:
2542:         for (row = cr1.row; row < cr1.row+numrows; row++) {
2543:            for (col = cr1.col; col < cr1.col+numcols; col++) {
2544:               cr = SocialCalc.crToCoord(col, row);
2545:               cell=sheet.GetAssuredCell(cr);
2546:               if (cell.readonly) continue;
2547:               if (saveundo) changes.AddUndo("set "+cr+" all", sheet.CellToString(cell));
2548:               var currentClipCol = cliprange.cr1.col + ((col-cr1.col) % (cliprange.cr2.col - cliprange.cr1.col + 1)); 
2549:               var currentClipRow = cliprange.cr1.row + ((row-cr1.row) % (cliprange.cr2.row - cliprange.cr1.row + 1));
2550:               crbase = SocialCalc.crToCoord(currentClipCol, currentClipRow);
2551:               basecell = clipsheet.GetAssuredCell(crbase);
2552:               if (rest == "all" || rest == "formats") {
2553:                 // get source width and hidden attribute
2554:                 // and copy to sheet
2555:                 if(row == cr1.row) { // only need 1st row of cols
2556:                   // col attributes
2557:                   sourceColname = SocialCalc.rcColname(cliprange.cr1.col + ((col-cr1.col) % (cliprange.cr2.col - cliprange.cr1.col + 1)));
2558:                   colWidth = clipsheet.colattribs.width[ sourceColname];
2559:                   colHide = clipsheet.colattribs.hide[sourceColname];
2560:                   if (colWidth != null) {
2561:                     // if source col width exists
2562:                     // set dest col width
2563:                     sheet.colattribs.width[SocialCalc.rcColname(col)] = colWidth;
2564:                     }
2565:                   if (colHide != null) {
2566:                     // if source col is hidden
2567:                     // set dest col hidden
2568:                     sheet.colattribs.hide[SocialCalc.rcColname(col)] = colHide;
2569:                     }
2570:                   }
2571:                 if(col == cr1.col) {  // only need 1st col or rows
2572:                   // row attributes
2573:                   sourceRow = cliprange.cr1.row + ((row-cr1.row) % (cliprange.cr2.row - cliprange.cr1.row + 1));
2574:                   rowHide = clipsheet.rowattribs.hide[sourceRow];
2575:                   if (rowHide != null) {
2576:                     // if source row is hidden
2577:                     // set dest row hidden
2578:                     sheet.rowattribs.hide[row] = rowHide;
2579:                     }
2580:                 }
2581:
2582:                 for (attrib in cellProperties) {
2583:                     if (cellProperties[attrib] == 1) continue; // copy only format attributes
2584:                     if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
2585:                        delete cell[attrib];
2586:                        }
2587:                     else {
2588:                        attribtable = SocialCalc.CellPropertiesTable[attrib];
2589:                        if (attribtable && basecell[attrib]) { // table indexes to expand to strings since other sheet may have diff indexes
2590:                           cell[attrib] = sheet.GetStyleNum(attribtable, clipsheet.GetStyleString(attribtable, basecell[attrib]));
2591:                           }
2592:                        else { // these are not table indexes
2593:                           cell[attrib] = basecell[attrib];
2594:                           }
2595:                        }
2596:                     }
2597:                  }
2598:               if (rest == "all" || rest == "formulas") {
2599:                  cell.datavalue = basecell.datavalue;
2600:                  cell.datatype = basecell.datatype;
2601:                  cell.valuetype = basecell.valuetype;
2602:                  if (cell.datatype == "f") { // offset relative coords, even in sheet references
2603:                     cell.formula = SocialCalc.OffsetFormulaCoords(basecell.formula, col - currentClipCol, row - currentClipRow);
2604:                     }
```

## js/socialcalc-3.js — insert adjust callsite and names update (2768-2848)

```
2768:      case "insertcol":
2769:      case "insertrow":
2770:         sheet.renderneeded = true;
2771:         sheet.changedrendervalues = true;
2772:         sheet.widgetsClean = false; //  force widgets to repaint - update cell reference in widget HTML
2773:         what = cmd.NextToken();
2774:         rest = cmd.RestOfString();
2775:         ParseRange();
2776:
2777:         if (cmd1 == "insertcol") {
2778:            coloffset = 1;
2779:            colend = cr1.col;
2780:            rowoffset = 0;
2781:            rowend = 1;
2782:            newcolstart = cr1.col;
2783:            newcolend = cr1.col;
2784:            newrowstart = 1;
2785:            newrowend = attribs.lastrow;
2786:            if (saveundo) changes.AddUndo("deletecol "+cr1.coord);
2787:            }
2788:         else {
2789:            coloffset = 0;
2790:            colend = 1;
2791:            rowoffset = 1;
2792:            rowend = cr1.row;
2793:            newcolstart = 1;
2794:            newcolend = attribs.lastcol;
2795:            newrowstart = cr1.row;
2796:            newrowend = cr1.row;
2797:            if (saveundo) changes.AddUndo("deleterow "+cr1.coord);
2798:            }
2799:
2800:         for (row=attribs.lastrow; row >= rowend; row--) { // copy the cells forward
2801:            for (col=attribs.lastcol; col >= colend; col--) {
2802:               crbase = SocialCalc.crToCoord(col, row);
2803:               cr = SocialCalc.crToCoord(col+coloffset, row+rowoffset);
2804:               if (!sheet.cells[crbase]) { // copying empty cell
2805:                  delete sheet.cells[cr]; // delete anything that may have been there
2806:                  }
2807:               else { // overwrite existing cell with moved contents
2808:                  sheet.cells[cr] = sheet.cells[crbase];
2809:                  }
2810:               }
2811:            }
2812:
2813:         for (row=newrowstart; row <= newrowend; row++) { // fill the "new" empty cells
2814:            for (col=newcolstart; col <= newcolend; col++) {
2815:               cr = SocialCalc.crToCoord(col, row);
2816:               cell = new SocialCalc.Cell(cr);
2817:               sheet.cells[cr] = cell;
2818:               crbase = SocialCalc.crToCoord(col-coloffset, row-rowoffset); // copy attribs of the one before (0 gives you A or 1)
2819:               basecell = sheet.GetAssuredCell(crbase);
2820:               for (attrib in cellProperties) {
2821:                  if (cellProperties[attrib] == 2) { // copy only format attributes
2822:                     cell[attrib] = basecell[attrib];
2823:                     }
2824:                  }
2825:               }
2826:            }
2827:
2828:         for (cr in sheet.cells) { // update cell references to moved cells in calculated formulas
2829:             cell = sheet.cells[cr];
2830:             if (cell && cell.datatype == "f") {
2831:                cell.formula = SocialCalc.AdjustFormulaCoords(cell.formula, cr1.col, coloffset, cr1.row, rowoffset);
2832:                }
2833:             if (cell) {
2834:                delete cell.parseinfo;
2835:                }
2836:             }
2837:
2838:         for (name in sheet.names) { // update cell references to moved cells in names
2839:            if (sheet.names[name]) { // works with "A1", "A1:A20", and "=formula" forms
2840:               v1 = sheet.names[name].definition;
2841:               v2 = "";
2842:               if (v1.charAt(0) == "=") {
2843:                  v2 = "=";
2844:                  v1 = v1.substring(1);
2845:                  }
2846:               sheet.names[name].definition = v2 +
2847:                  SocialCalc.AdjustFormulaCoords(v1, cr1.col, coloffset, cr1.row, rowoffset);
2848:               }
```

## js/socialcalc-3.js — delete adjust callsite and names update (2916-3006)

```
2916:      case "deletecol":
2917:      case "deleterow":
2918:         sheet.renderneeded = true;
2919:         sheet.changedrendervalues = true;
2920:         sheet.widgetsClean = false; // update cell reference in widget HTML - force widgets to repaint
2921:         what = cmd.NextToken();
2922:         rest = cmd.RestOfString();
2923:         lastcol = attribs.lastcol; // save old values since ParseRange sets...
2924:         lastrow = attribs.lastrow;
2925:         ParseRange();
2926:
2927:         if (cmd1 == "deletecol") {
2928:            coloffset = cr1.col - cr2.col - 1;
2929:            rowoffset = 0;
2930:            colstart = cr2.col + 1;
2931:            rowstart = 1;
2932:            }
2933:         else {
2934:            coloffset = 0;
2935:            rowoffset = cr1.row - cr2.row - 1;
2936:            colstart = 1;
2937:            rowstart = cr2.row + 1;
2938:            }
2939:
2940:         for (row=rowstart; row <= lastrow - rowoffset; row++) { // check for readonly cells
2941:            for (col=colstart; col <= lastcol - coloffset; col++) {
2942:               cr = SocialCalc.crToCoord(col+coloffset, row+rowoffset);
2943:               cell = sheet.cells[cr];
2944:               if (cell && cell.readonly) {
2945:                    errortext = "Unable to remove " + (cmd1 == "deletecol" ? "column" : "row") + ", because cell " + cell.coord + " is locked";
2946:                    return errortext;
2947:               }
2948:            }
2949:         }
2950:
2951:         for (row=rowstart; row <= lastrow - rowoffset; row++) { // copy the cells backwards - extra so no dup of last set
2952:            for (col=colstart; col <= lastcol - coloffset; col++) {
2953:               cr = SocialCalc.crToCoord(col+coloffset, row+rowoffset);
2954:               if (saveundo && (row<rowstart-rowoffset || col<colstart	-coloffset)) { // save cells that are overwritten as undo info
2955:                  cell = sheet.cells[cr];
2956:                  if (!cell) { // empty cell
2957:                     changes.AddUndo("erase "+cr+" all");
2958:                     }
2959:                  else {
2960:                     changes.AddUndo("set "+cr+" all", sheet.CellToString(cell));
2961:                     }
2962:                  }
2963:               crbase = SocialCalc.crToCoord(col, row);
2964:               cell = sheet.cells[crbase];
2965:               if (!cell) { // copying empty cell
2966:                  delete sheet.cells[cr]; // delete anything that may have been there
2967:                  }
2968:               else { // overwrite existing cell with moved contents
2969:                  sheet.cells[cr] = cell;
2970:                  }
2971:               }
2972:            }
2973:
2974://!!! multiple deletes isn't setting #REF!; need to fix up #REF!'s on undo but only those!
2975:
2976:         for (cr in sheet.cells) { // update cell references to moved cells in calculated formulas
2977:             cell = sheet.cells[cr];
2978:             if (cell) {
2979:                if (cell.datatype == "f") {
2980:                   oldformula = cell.formula;
2981:                   cell.formula = SocialCalc.AdjustFormulaCoords(oldformula, cr1.col, coloffset, cr1.row, rowoffset);
2982:                   if (cell.formula != oldformula) {
2983:                      delete cell.parseinfo;
2984:                      if (saveundo && cell.formula.indexOf("#REF!")!=-1) { // save old version only if removed coord
2985:                         oldcr = SocialCalc.coordToCr(cr);
2986:                         changes.AddUndo("set "+SocialCalc.rcColname(oldcr.col-coloffset)+(oldcr.row-rowoffset)+
2987:                                         " formula "+oldformula);
2988:                         }
2989:                      }
2990:                   }
2991:                else {
2992:                   delete cell.parseinfo;
2993:                   }
2994:                }
2995:             }
2996:
2997:         for (name in sheet.names) { // update cell references to moved cells in names
2998:            if (sheet.names[name]) { // works with "A1", "A1:A20", and "=formula" forms
2999:               v1 = sheet.names[name].definition;
3000:               v2 = "";
3001:               if (v1.charAt(0) == "=") {
3002:                  v2 = "=";
3003:                  v1 = v1.substring(1);
3004:                  }
3005:               sheet.names[name].definition = v2 +
3006:                  SocialCalc.AdjustFormulaCoords(v1, cr1.col, coloffset, cr1.row, rowoffset);
```

## js/socialcalc-3.js — movepaste/moveinsert replacement callsite (3108-3397)

```
3108:      case "movepaste":
3109:      case "moveinsert":
3110:
3111:         /** @type {any} */
3112:         var movingcells;
3113:         /** @type {any} */
3114:         var dest;
3115:         /** @type {any} */
3116:         var destcr;
3117:         /** @type {any} */
3118:         var inserthoriz;
3119:         /** @type {any} */
3120:         var insertvert;
3121:         /** @type {any} */
3122:         var pushamount;
3123:         /** @type {any} */
3124:         var movedto;
3125:
3126:         sheet.renderneeded = true;
3127:         sheet.changedrendervalues = true;
3128:         if (saveundo) changes.AddUndo("changedrendervalues"); // to take care of undone pasted spans
3129:         what = cmd.NextToken();
3130:         dest = cmd.NextToken();
3131:         rest = cmd.RestOfString(); // rest is all/formulas/formats
3132:         if (rest=="") rest = "all";
3133:
3134:         ParseRange();
3135:
3136:         destcr = SocialCalc.coordToCr(dest);
3137:
3138:         coloffset = destcr.col - cr1.col;
3139:         rowoffset = destcr.row - cr1.row;
3140:         numcols = cr2.col - cr1.col + 1;
3141:         numrows = cr2.row - cr1.row + 1;
3142:
3143:         // get a copy of moving cells and erase from where they were
3144:
3145:         movingcells = {};
3146:
3147:         for (row = cr1.row; row <= cr2.row; row++) {
3148:            for (col = cr1.col; col <= cr2.col; col++) {
3149:               cr = SocialCalc.crToCoord(col, row);
3150:               cell=sheet.GetAssuredCell(cr);
3151:               if (cell.readonly) continue;
3152:               if (saveundo) changes.AddUndo("set "+cr+" all", sheet.CellToString(cell));
3153:
3154:               if (!sheet.cells[cr]) { // if had nothing
3155:                  continue; // don't save anything
3156:                  }
3157:               movingcells[cr] = new SocialCalc.Cell(cr); // create new cell to copy
3158:
3159:               for (attrib in cellProperties) { // go through each property
3160:                  if (typeof cell[attrib] === "undefined") { // don't copy undefined things and no need to delete
3161:                     continue;
3162:                     }
3163:                  else {
3164:                     movingcells[cr][attrib] = cell[attrib]; // copy for potential moving
3165:                     }
3166:                  if (rest == "all") {
3167:                     delete cell[attrib];
3168:                     }
3169:                  if (rest == "formulas") {
3170:                     if (cellProperties[attrib] == 1 || cellProperties[attrib] == 3) {
3171:                        delete cell[attrib];
3172:                        }
3173:                     }
3174:                  if (rest == "formats") {
3175:                     if (cellProperties[attrib] == 2) {
3176:                        delete cell[attrib];
3177:                        }
3178:                     }
3179:                  }
3180:               if (rest == "formulas") { // leave pristene deleted cell
3181:                  cell.datavalue = "";
3182:                  cell.datatype = null;
3183:                  cell.formula = "";
3184:                  cell.valuetype = "b";
3185:                  }
3186:               if (rest == "all") { // leave nothing for move all
3187:                  delete sheet.cells[cr];
3188:                  }
3189:               }
3190:            }
3191:
3192:         // if moveinsert, check destination OK, and calculate pushing parameters
3193:
3194:         if (cmd1 == "moveinsert") {
3195:            inserthoriz = false;
3196:            insertvert = false;
3197:            if (rowoffset==0 && (destcr.col < cr1.col || destcr.col > cr2.col)) {
3198:               if (destcr.col < cr1.col) { // moving left
3199:                  pushamount = cr1.col - destcr.col;
3200:                  inserthoriz = -1;
3201:                  }
3202:               else {
3203:                  destcr.col -= 1;
3204:                  coloffset = destcr.col - cr2.col;
3205:                  pushamount = destcr.col - cr2.col;
3206:                  inserthoriz = 1;
3207:                  }
3208:               }
3209:            else if (coloffset==0 && (destcr.row < cr1.row || destcr.row > cr2.row)) {
3210:               if (destcr.row < cr1.row) { // moving up
3211:                  pushamount = cr1.row - destcr.row;
3212:                  insertvert = -1;
3213:                  }
3214:               else {
3215:                  destcr.row -= 1;
3216:                  rowoffset = destcr.row - cr2.row;
3217:                  pushamount = destcr.row - cr2.row;
3218:                  insertvert = 1;
3219:                  }
3220:               }
3221:            else {
3222:               cmd1 = "movepaste"; // not allowed right now - ignore
3223:               }
3224:            }
3225:
3226:         // push any cells that need pushing
3227:
3228:         movedto = {}; // remember what was moved where
3229:
3230:         if (insertvert) {
3231:            for (row = 0; row < pushamount; row++) {
3232:               for (col = cr1.col; col <= cr2.col; col++) {
3233:                  if (insertvert < 0) {
3234:                     crbase = SocialCalc.crToCoord(col, destcr.row+pushamount-row-1); // from cell
3235:                     cr = SocialCalc.crToCoord(col, cr2.row-row); // to cell
3236:                     }
3237:                  else {
3238:                     crbase = SocialCalc.crToCoord(col, destcr.row-pushamount+row+1); // from cell
3239:                     cr = SocialCalc.crToCoord(col, cr1.row+row); // to cell
3240:                     }
3241:
3242:                  basecell = sheet.GetAssuredCell(crbase);
3243:                  if (saveundo) changes.AddUndo("set "+crbase+" all", sheet.CellToString(basecell));
3244:
3245:                  cell = sheet.GetAssuredCell(cr);
3246:                  if (rest == "all" || rest == "formats") {
3247:                     for (attrib in cellProperties) {
3248:                        if (cellProperties[attrib] == 1) continue; // copy only format attributes
3249:                        if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
3250:                           delete cell[attrib];
3251:                           }
3252:                        else {
3253:                           cell[attrib] = basecell[attrib];
3254:                           }
3255:                        }
3256:                     }
3257:                  if (rest == "all" || rest == "formulas") {
3258:                     cell.datavalue = basecell.datavalue;
3259:                     cell.datatype = basecell.datatype;
3260:                     cell.valuetype = basecell.valuetype;
3261:                     cell.formula = basecell.formula;
3262:                     delete cell.parseinfo;
3263:                     cell.errors = basecell.errors;
3264:                     }
3265:                  delete cell.displaystring;
3266:
3267:                  movedto[crbase] = cr; // old crbase is now at cr
3268:                  }
3269:               }
3270:            }
3271:         if (inserthoriz) {
3272:            for (col = 0; col < pushamount; col++) {
3273:               for (row = cr1.row; row <= cr2.row; row++) {
3274:                  if (inserthoriz < 0) {
3275:                     crbase = SocialCalc.crToCoord(destcr.col+pushamount-col-1, row);
3276:                     cr = SocialCalc.crToCoord(cr2.col-col, row);
3277:                     }
3278:                  else {
3279:                     crbase = SocialCalc.crToCoord(destcr.col-pushamount+col+1, row);
3280:                     cr = SocialCalc.crToCoord(cr1.col+col, row);
3281:                     }
3282:
3283:                  basecell = sheet.GetAssuredCell(crbase);
3284:                  if (saveundo) changes.AddUndo("set "+crbase+" all", sheet.CellToString(basecell));
3285:
3286:                  cell = sheet.GetAssuredCell(cr);
3287:                  if (rest == "all" || rest == "formats") {
3288:                     for (attrib in cellProperties) {
3289:                        if (cellProperties[attrib] == 1) continue; // copy only format attributes
3290:                        if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
3291:                           delete cell[attrib];
3292:                           }
3293:                        else {
3294:                           cell[attrib] = basecell[attrib];
3295:                           }
3296:                        }
3297:                     }
3298:                  if (rest == "all" || rest == "formulas") {
3299:                     cell.datavalue = basecell.datavalue;
3300:                     cell.datatype = basecell.datatype;
3301:                     cell.valuetype = basecell.valuetype;
3302:                     cell.formula = basecell.formula;
3303:                     delete cell.parseinfo;
3304:                     cell.errors = basecell.errors;
3305:                     }
3306:                  delete cell.displaystring;
3307:
3308:                  movedto[crbase] = cr; // old crbase is now at cr
3309:                  }
3310:               }
3311:            }
3312:
3313:         // paste moved cells into new place
3314:
3315:         if (destcr.col+numcols-1 > attribs.lastcol) attribs.lastcol = destcr.col+numcols-1;
3316:         if (destcr.row+numrows-1 > attribs.lastrow) attribs.lastrow = destcr.row+numrows-1;
3317:
3318:         for (row = cr1.row; row < cr1.row+numrows; row++) {
3319:            for (col = cr1.col; col < cr1.col+numcols; col++) {
3320:               cr = SocialCalc.crToCoord(col+coloffset, row+rowoffset);
3321:               cell=sheet.GetAssuredCell(cr);
3322:               if (cell.readonly) continue;
3323:               if (saveundo) changes.AddUndo("set "+cr+" all", sheet.CellToString(cell));
3324:
3325:               crbase = SocialCalc.crToCoord(col, row); // get old cell to move
3326:
3327:               movedto[crbase] = cr; // old crbase (moved cell) will now be at cr (destination)
3328:
3329:               if (rest == "all" && !movingcells[crbase]) { // moving an empty cell
3330:                  delete sheet.cells[cr]; // make the cell empty
3331:                  continue;
3332:                  }
3333:
3334:               basecell = movingcells[crbase];
3335:               if (!basecell) basecell = sheet.GetAssuredCell(crbase);
3336:
3337:               if (rest == "all" || rest == "formats") {
3338:                  for (attrib in cellProperties) {
3339:                     if (cellProperties[attrib] == 1) continue; // copy only format attributes
3340:                     if (typeof basecell[attrib] === "undefined" || cellProperties[attrib] == 3) {
3341:                        delete cell[attrib];
3342:                        }
3343:                     else {
3344:                        cell[attrib] = basecell[attrib];
3345:                        }
3346:                     }
3347:                  }
3348:               if (rest == "all" || rest == "formulas") {
3349:                  cell.datavalue = basecell.datavalue;
3350:                  cell.datatype = basecell.datatype;
3351:                  cell.valuetype = basecell.valuetype;
3352:                  cell.formula = basecell.formula;
3353:                  delete cell.parseinfo;
3354:                  cell.errors = basecell.errors;
3355:                  if (basecell.comment) { // comments are pasted as part of content, though not filled, etc.
3356:                     cell.comment = basecell.comment;
3357:                     }
3358:                  else if (cell.comment) {
3359:                     delete cell.comment;
3360:                     }
3361:                  }
3362:               delete cell.displaystring;
3363:               }
3364:            }
3365:
3366:         // do fixups
3367:
3368:         for (cr in sheet.cells) { // update cell references to moved cells in calculated formulas
3369:             cell = sheet.cells[cr];
3370:             if (cell) {
3371:                if (cell.datatype == "f") {
3372:                   oldformula = cell.formula;
3373:                   cell.formula = SocialCalc.ReplaceFormulaCoords(oldformula, movedto);
3374:                   if (cell.formula != oldformula) {
3375:                      delete cell.parseinfo;
3376:                      if (saveundo && !movedto[cr]) { // moved cells are already saved for undo
3377:                         changes.AddUndo("set "+cr+" formula "+oldformula);
3378:                         }
3379:                      }
3380:                   }
3381:                else {
3382:                   delete cell.parseinfo;
3383:                   }
3384:                }
3385:             }
3386:
3387:         for (name in sheet.names) { // update cell references to moved cells in names
3388:            if (sheet.names[name]) { // works with "A1", "A1:A20", and "=formula" forms
3389:               v1 = sheet.names[name].definition;
3390:               oldformula = v1;
3391:               v2 = "";
3392:               if (v1.charAt(0) == "=") {
3393:                  v2 = "=";
3394:                  v1 = v1.substring(1);
3395:                  }
3396:               sheet.names[name].definition = v2 +
3397:                  SocialCalc.ReplaceFormulaCoords(v1, movedto);
```

## js/formula1.js — token constants and operator expansion (44-94)

```
44:
45:   SocialCalc.Formula.ParseState = {num: 1, alpha: 2, coord: 3, string: 4, stringquote: 5, numexp1: 6, numexp2: 7, alphanumeric: 8, specialvalue:9};
46:
47:   SocialCalc.Formula.TokenType = {num: 1, coord: 2, op: 3, name: 4, error: 5, string: 6, space: 7};
48:
49:   SocialCalc.Formula.CharClass = {num: 1, numstart: 2, op: 3, eof: 4, alpha: 5, incoord: 6, error: 7, quote: 8, space: 9, specialstart: 10};
50: 
51:   SocialCalc.Formula.CharClassTable = {
52:      " ": 9, "!": 3, '"': 8, "'": 8, "#": 10, "$":6, "%":3, "&":3, "(": 3, ")": 3, "*": 3, "+": 3, ",": 3, "-": 3, ".": 2, "/": 3,
53:       "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1, "9": 1,
54:       ":": 3, "<": 3, "=": 3, ">": 3,
55:       "A": 5, "B": 5, "C": 5, "D": 5, "E": 5, "F": 5, "G": 5, "H": 5, "I": 5, "J": 5, "K": 5, "L": 5, "M": 5, "N": 5,
56:       "O": 5, "P": 5, "Q": 5, "R": 5, "S": 5, "T": 5, "U": 5, "V": 5, "W": 5, "X": 5, "Y": 5, "Z": 5,
57:       "^": 3, "_": 5,
58:       "a": 5, "b": 5, "c": 5, "d": 5, "e": 5, "f": 5, "g": 5, "h": 5, "i": 5, "j": 5, "k": 5, "l": 5, "m": 5, "n": 5,
59:       "o": 5, "p": 5, "q": 5, "r": 5, "s": 5, "t": 5, "u": 5, "v": 5, "w": 5, "x": 5, "y": 5, "z": 5
60:       };
61:
62:   SocialCalc.Formula.UpperCaseTable = {
63:       "a": "A", "b": "B", "c": "C", "d": "D", "e": "E", "f": "F", "g": "G", "h": "H", "i": "I", "j": "J", "k": "K", "l": "L", "m": "M",
64:       "n": "N", "o": "O", "p": "P", "q": "Q", "r": "R", "s": "S", "t": "T", "u": "U", "v": "V", "w": "W", "x": "X", "y": "Y", "z": "Z",
65:       "A": "A", "B": "B", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G", "H": "H", "I": "I", "J": "J", "K": "K", "L": "L", "M": "M",
66:       "N": "N", "O": "O", "P": "P", "Q": "Q", "R": "R", "S": "S", "T": "T", "U": "U", "V": "V", "W": "W", "X": "X", "Y": "Y", "Z": "Z"
67:       }
68:
69:   SocialCalc.Formula.SpecialConstants = { // names that turn into constants for name lookup
70:      "#NULL!": "0,e#NULL!", "#NUM!": "0,e#NUM!", "#DIV/0!": "0,e#DIV/0!", "#VALUE!": "0,e#VALUE!",
71:      "#REF!": "0,e#REF!", "#NAME?": "0,e#NAME?"};
72:
73:
74:   // Operator Precedence table
75:   //
76:   // 1- !, 2- : ,, 3- M P, 4- %, 5- ^, 6- * /, 7- + -, 8- &, 9- < > = G(>=) L(<=) N(<>),
77:   // Negative value means Right Associative
78:
79:   SocialCalc.Formula.TokenPrecedence = {
80:      "!": 1,
81:      ":": 2, ",": 2,
82:      "M": -3, "P": -3,
83:      "%": 4,
84:      "^": 5,
85:      "*": 6, "/": 6,
86:      "+": 7, "-": 7,
87:      "&": 8,
88:      "<": 9, ">": 9, "G": 9, "L": 9, "N": 9
89:      };
90:
91:   // Convert one-char token text to input text:
92:
93:   SocialCalc.Formula.TokenOpExpansion = {'G': '>=', 'L': '<=', 'M': '-', 'N': '<>', 'P': '+'};
94:
```

## js/formula1.js — parser entry and coordinate regex (153-220)

```
153:SocialCalc.Formula.ParseFormulaIntoTokens = function(line) {
154:
155:   var i, ch, cclass, last_token, last_token_type, last_token_text, t;
156:
157:   var scf = SocialCalc.Formula;
158:   var scc = SocialCalc.Constants;
159:   var parsestate = scf.ParseState;
160:   var tokentype = scf.TokenType;
161:   var charclass = scf.CharClass;
162:   var charclasstable = scf.CharClassTable;
163:   var uppercasetable = scf.UpperCaseTable; // much faster than toUpperCase function
164:   var pushtoken = scf.ParsePushToken;
165:   var coordregex = /^\$?[A-Z]{1,2}\$?[1-9]\d*$/i;
166:
167:   /** @type {any[]} */
168:   var parseinfo = [];
169:   var str = "";
170:   var state = 0;
171:   var haddecimal = false;
172:   var twochrop = "";
173:   
174:  for (i=0; i<=line.length; i++) {
175:      if (i<line.length) {
176:         ch = line.charAt(i);
177:         cclass = charclasstable[ch];
178:         }
179:      else {
180:         ch = "";
181:         cclass = charclass.eof;
182:         }
183:
184:      if (state == parsestate.num) {
185:         if (cclass == charclass.num) {
186:            str += ch;
187:            }
188:         else if (cclass == charclass.numstart && !haddecimal) {
189:            haddecimal = true;
190:            str += ch;
191:            }
192:         else if (ch == "E" || ch == "e") {
193:            str += ch;
194:            haddecimal = false;
195:            state = parsestate.numexp1;
196:            }
197:         else { // end of number - save it
198:            pushtoken(parseinfo, str, tokentype.num, 0);
199:            haddecimal = false;
200:            state = 0;
201:            }
202:         }
203:
204:      if (state == parsestate.numexp1) {
205:         if (cclass == parsestate.num) {
206:            state = parsestate.numexp2;
207:            }
208:         else if ((ch == '+' || ch == '-') && (uppercasetable[str.charAt(str.length-1)] == 'E')) {
209:            str += ch;
210:            }
211:         else if (ch == 'E' || ch == 'e') {
212:            ;
213:            }
214:         else {
215:            pushtoken(parseinfo, scc.s_parseerrexponent, tokentype.error, 0);
216:            state = 0;
217:            }
218:         }
219:
220:      if (state == parsestate.numexp2) {
```

## js/socialcalc-3.d.ts — public signatures (181-192)

```
181:   function ScheduleSheetCommands(sheet: Sheet, cmdstr: string, saveundo?: boolean): void;
182:   function SheetCommandsTimerRoutine(sci: SheetCommandInfo, parseobj: Parse, saveundo?: boolean): void;
183:   function ExecuteSheetCommand(sheet: Sheet, cmd: Parse, saveundo?: boolean): string;
184:
185:   function SheetUndo(sheet: Sheet): void;
186:   function SheetRedo(sheet: Sheet): void;
187:   function CreateAuditString(sheet: Sheet): string;
188:   function GetStyleNum(sheet: Sheet, atype: string, style: string): number;
189:   function GetStyleString(sheet: Sheet, atype: string, num: number): string | null;
190:   function OffsetFormulaCoords(formula: string, coloffset: number, rowoffset: number): string;
191:   function AdjustFormulaCoords(formula: string, col: number, coloffset: number, row: number, rowoffset: number): string;
192:   function ReplaceFormulaCoords(formula: string, movedto: { [coord: string]: string }): string;
```

## spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json

```
1:{
2:  "directCases": [
3:    {
4:      "name": "offset preserves string literal that looks like a reference",
5:      "method": "offset",
6:      "formula": "CONCATENATE(\"A1 should stay\",A1)",
7:      "args": { "coloffset": 1, "rowoffset": 2 },
8:      "expected": "CONCATENATE(\"A1 should stay\",B3)",
9:      "invariant": "Only coord token A1 shifts; the string token remains byte-equivalent after quote re-escaping."
10:    },
11:    {
12:      "name": "offset intentionally shifts sheet-qualified references",
13:      "method": "offset",
14:      "formula": "Sheet2!A1+B1",
15:      "args": { "coloffset": 1, "rowoffset": 0 },
16:      "expected": "SHEET2!B1+C1",
17:      "invariant": "OffsetFormulaCoords does not honor sheetref and shifts both coords; this preserves current fill/paste behavior."
18:    },
19:    {
20:      "name": "adjust skips sheet-qualified references",
21:      "method": "adjust",
22:      "formula": "Sheet2!A1+B1",
23:      "args": { "col": 1, "coloffset": 2, "row": 1, "rowoffset": 0 },
24:      "expected": "SHEET2!A1+D1",
25:      "invariant": "AdjustFormulaCoords sets sheetref after ! and skips the sheet-qualified A1 while shifting local B1."
26:    },
27:    {
28:      "name": "replace skips sheet-qualified references",
29:      "method": "replace",
30:      "formula": "Sheet2!A1+B1",
31:      "args": { "movedto": { "A1": "C3", "B1": "D4" } },
32:      "expected": "SHEET2!A1+D4",
33:      "invariant": "ReplaceFormulaCoords skips the sheet-qualified A1 but replaces local B1."
34:    },
35:    {
36:      "name": "offset preserves absolute column and row markers",
37:      "method": "offset",
38:      "formula": "$A1+A$1+$A$1",
39:      "args": { "coloffset": 2, "rowoffset": 2 },
40:      "expected": "$A3+C$1+$A$1",
41:      "invariant": "A leading $ locks the column and a later $ locks the row."
42:    },
43:    {
44:      "name": "adjust deletion turns removed refs into REF",
45:      "method": "adjust",
46:      "formula": "B1+C1",
47:      "args": { "col": 2, "coloffset": -1, "row": 1, "rowoffset": 0 },
48:      "expected": "#REF!+B1",
49:      "invariant": "Refs in the deleted column band become #REF!, while later refs shift backward."
50:    },
51:    {
52:      "name": "replace preserves absolute markers",
53:      "method": "replace",
54:      "formula": "$A1+A$2",
55:      "args": { "movedto": { "A1": "B5", "A2": "B6" } },
56:      "expected": "$B5+B$6",
57:      "invariant": "Replacement copies original absolute markers onto the target coordinate parts."
58:    },
59:    {
60:      "name": "whole-column names are not rewrite coordinates",
61:      "method": "offset",
62:      "formula": "SUM(N:N)+SUM(T:T)",
63:      "args": { "coloffset": 1, "rowoffset": 0 },
64:      "expected": "SUM(N:N)+SUM(T:T)",
65:      "invariant": "Whole-column N:T spellings parse as name tokens, not coord tokens."
66:    },
67:    {
68:      "name": "whole-column AA stays name while AA1 shifts",
69:      "method": "offset",
70:      "formula": "SUM(AA:AA)+AA1",
71:      "args": { "coloffset": 1, "rowoffset": 0 },
72:      "expected": "SUM(AA:AA)+AB1",
73:      "invariant": "AA in AA:AA is a name token; AA1 is a coord token."
74:    },
75:    {
76:      "name": "range endpoints are rewritten independently",
77:      "method": "replace",
78:      "formula": "SUM(A1:B2)",
79:      "args": { "movedto": { "A1": "C3" } },
80:      "expected": "SUM(C3:B2)",
81:      "invariant": "Current ReplaceFormulaCoords has no whole-range extent move; only mapped endpoint A1 changes."
82:    },
83:    {
84:      "name": "doubled quotes survive re-emission",
85:      "method": "offset",
86:      "formula": "CONCATENATE(\"a\"\"b\"\"c\",A1)",
87:      "args": { "coloffset": 1, "rowoffset": 0 },
88:      "expected": "CONCATENATE(\"a\"\"b\"\"c\",B1)",
89:      "invariant": "Inner quote bytes are doubled on output."
90:    },
91:    {
92:      "name": "operator expansion preserves comparator spelling",
93:      "method": "offset",
94:      "formula": "A1>=B1",
95:      "args": { "coloffset": 0, "rowoffset": 0 },
96:      "expected": "A1>=B1",
97:      "invariant": "Current JS parser compresses >= to G then TokenOpExpansion re-emits >=; Rust preserves spelling directly."
98:    }
99:  ],
100:  "commandCases": [
101:    {
102:      "name": "filldown offsets refs while preserving HTML quotes",
103:      "setup": [
104:        "set B4 formula TODAY()",
105:        "set B5 formula TODAY()",
106:        "set B6 formula TODAY()",
107:        "set A4 formula IF(B4=TODAY(),\"<span style=\"\"background-color:rgb(81,184,72);color:rgb(81,184,72)\"\">_______</span>\",\"\")"
108:      ],
109:      "commands": ["filldown A4:A6 formulas"],
110:      "expectedCells": [
111:        {
112:          "coord": "A5",
113:          "field": "formula",
114:          "expected": "IF(B5=TODAY(),\"<span style=\"\"background-color:rgb(81,184,72);color:rgb(81,184,72)\"\">_______</span>\",\"\")"
115:        },
116:        {
117:          "coord": "A6",
118:          "field": "formula",
119:          "expected": "IF(B6=TODAY(),\"<span style=\"\"background-color:rgb(81,184,72);color:rgb(81,184,72)\"\">_______</span>\",\"\")"
120:        }
121:      ]
122:    },
123:    {
124:      "name": "paste offsets local ref but leaves whole column and string literal",
125:      "setup": [
126:        "set A1 value n 1",
127:        "set B1 formula A1+SUM(N:N)+\"A1\""
128:      ],
129:      "commands": ["copy B1", "paste D3 formulas"],
130:      "expectedCells": [
131:        {
132:          "coord": "D3",
133:          "field": "formula",
134:          "expected": "C3+SUM(N:N)+\"A1\""
135:        }
136:      ]
137:    },
138:    {
139:      "name": "deletecol updates formula through AdjustFormulaCoords",
140:      "setup": [
141:        "set A1 value n 1",
142:        "set B1 value n 2",
143:        "set C1 formula B1+C1"
144:      ],
145:      "commands": ["deletecol B1"],
146:      "expectedCells": [
147:        {
148:          "coord": "B1",
149:          "field": "formula",
150:          "expected": "#REF!+B1"
151:        }
152:      ]
153:    }
154:  ]
155:}
```

## crates/formula-ref-core/src/lib.rs — Rust core source

```
1:use std::collections::HashMap;
2:use std::sync::{LazyLock, Mutex};
3:
4:const TOKEN_NUM: u8 = 1;
5:const TOKEN_COORD: u8 = 2;
6:const TOKEN_OP: u8 = 3;
7:const TOKEN_NAME: u8 = 4;
8:const TOKEN_STRING: u8 = 6;
9:
10:#[derive(Clone, Debug)]
11:struct Token {
12:    kind: u8,
13:    text: String,
14:}
15:
16:static RESULT: LazyLock<Mutex<Vec<u8>>> = LazyLock::new(|| Mutex::new(Vec::new()));
17:
18:fn set_result(bytes: &[u8]) {
19:    let mut guard = RESULT.lock().expect("result mutex poisoned");
20:    guard.clear();
21:    guard.extend_from_slice(bytes);
22:}
23:
24:fn expand_op(text: &str) -> &str {
25:    match text {
26:        "G" => ">=",
27:        "L" => "<=",
28:        "M" => "-",
29:        "N" => "<>",
30:        "P" => "+",
31:        other => other,
32:    }
33:}
34:
35:fn char_class(ch: char) -> u8 {
36:    match ch {
37:        '0'..='9' => 1,
38:        '.' => 2,
39:        '!' | '%' | '&' | '(' | ')' | '*' | '+' | ',' | '-' | '/' | ':' | '<' | '=' | '>' | '^' => 3,
40:        '$' => 6,
41:        '"' | '\'' => 8,
42:        ' ' | '\t' | '\r' | '\n' => 9,
43:        '#' => 10,
44:        'A'..='Z' | 'a'..='z' | '_' => 5,
45:        _ => 7,
46:    }
47:}
48:
49:fn is_coord_shape(s: &str) -> bool {
50:    let upper = s.to_ascii_uppercase();
51:    let mut chars = upper.chars().peekable();
52:    if chars.peek() == Some(&'$') {
53:        chars.next();
54:    }
55:    let mut col_len = 0u8;
56:    while col_len < 2 {
57:        match chars.peek() {
58:            Some(c) if c.is_ascii_alphabetic() => {
59:                chars.next();
60:                col_len += 1;
61:            }
62:            _ => break,
63:        }
64:    }
65:    if col_len == 0 {
66:        return false;
67:    }
68:    if chars.peek() == Some(&'$') {
69:        chars.next();
70:    }
71:    match chars.next() {
72:        Some(c) if ('1'..='9').contains(&c) => {}
73:        _ => return false,
74:    }
75:    while matches!(chars.peek(), Some(c) if c.is_ascii_digit()) {
76:        chars.next();
77:    }
78:    chars.peek().is_none()
79:}
80:
81:fn parse_formula_into_tokens(line: &str) -> Vec<Token> {
82:    let chars: Vec<char> = line.chars().collect();
83:    let mut i = 0usize;
84:    let mut tokens = Vec::new();
85:    let mut state = 0u8;
86:    let mut str_buf = String::new();
87:    let mut had_decimal = false;
88:
89:    const ST_NUM: u8 = 1;
90:    const ST_ALPHA: u8 = 2;
91:    const ST_COORD: u8 = 3;
92:    const ST_STRING: u8 = 4;
93:    const ST_STRINGQUOTE: u8 = 5;
94:    const ST_NUMEXP1: u8 = 6;
95:    const ST_NUMEXP2: u8 = 7;
96:    const ST_ALPHANUMERIC: u8 = 8;
97:    const ST_SPECIAL: u8 = 9;
98:
99:    let push_token =
100:        |tokens: &mut Vec<Token>, text: String, kind: u8| tokens.push(Token { kind, text });
101:
102:    while i <= chars.len() {
103:        let (ch, cclass) = if i < chars.len() {
104:            let ch = chars[i];
105:            (ch, char_class(ch))
106:        } else {
107:            ('\0', 4)
108:        };
109:
110:        if state == ST_NUM {
111:            if cclass == 1 {
112:                str_buf.push(ch);
113:                i += 1;
114:                continue;
115:            }
116:            if cclass == 2 && !had_decimal {
117:                had_decimal = true;
118:                str_buf.push(ch);
119:                i += 1;
120:                continue;
121:            }
122:            if ch == 'E' || ch == 'e' {
123:                str_buf.push(ch);
124:                had_decimal = false;
125:                state = ST_NUMEXP1;
126:                i += 1;
127:                continue;
128:            }
129:            push_token(&mut tokens, str_buf.clone(), TOKEN_NUM);
130:            str_buf.clear();
131:            had_decimal = false;
132:            state = 0;
133:        }
134:
135:        if state == ST_NUMEXP1 {
136:            if cclass == 1 {
137:                state = ST_NUMEXP2;
138:                continue;
139:            }
140:            if (ch == '+' || ch == '-')
141:                && str_buf
142:                    .chars()
143:                    .last()
144:                    .map(|c| c.eq_ignore_ascii_case(&'e'))
145:                    .unwrap_or(false)
146:            {
147:                str_buf.push(ch);
148:                i += 1;
149:                continue;
150:            }
151:            push_token(&mut tokens, str_buf.clone(), TOKEN_NUM);
152:            str_buf.clear();
153:            state = 0;
154:            continue;
155:        }
156:
157:        if state == ST_NUMEXP2 {
158:            if cclass == 1 {
159:                str_buf.push(ch);
160:                i += 1;
161:                continue;
162:            }
163:            push_token(&mut tokens, str_buf.clone(), TOKEN_NUM);
164:            str_buf.clear();
165:            state = 0;
166:            continue;
167:        }
168:
169:        if state == ST_ALPHA {
170:            if cclass == 1 {
171:                state = ST_COORD;
172:            } else if cclass == 5 || ch == '.' {
173:                str_buf.push(ch);
174:                i += 1;
175:                continue;
176:            } else if cclass == 6 {
177:                state = ST_COORD;
178:            } else if cclass == 3 || cclass == 2 || cclass == 9 || cclass == 4 {
179:                push_token(
180:                    &mut tokens,
181:                    str_buf.to_ascii_uppercase(),
182:                    TOKEN_NAME,
183:                );
184:                str_buf.clear();
185:                state = 0;
186:                continue;
187:            } else {
188:                state = 0;
189:                continue;
190:            }
191:            if state != ST_COORD {
192:                continue;
193:            }
194:        }
195:
196:        if state == ST_COORD {
197:            if cclass == 1 || cclass == 6 {
198:                str_buf.push(ch);
199:                i += 1;
200:                continue;
201:            }
202:            if cclass == 5 {
203:                state = ST_ALPHANUMERIC;
204:                continue;
205:            }
206:            if cclass == 3 || cclass == 2 || cclass == 4 || cclass == 9 {
207:                let upper = str_buf.to_ascii_uppercase();
208:                let kind = if is_coord_shape(&upper) {
209:                    TOKEN_COORD
210:                } else {
211:                    TOKEN_NAME
212:                };
213:                push_token(&mut tokens, upper, kind);
214:                str_buf.clear();
215:                state = 0;
216:                continue;
217:            }
218:            state = 0;
219:            continue;
220:        }
221:
222:        if state == ST_ALPHANUMERIC {
223:            if cclass == 1 || cclass == 5 {
224:                str_buf.push(ch);
225:                i += 1;
226:                continue;
227:            }
228:            if cclass == 3 || cclass == 2 || cclass == 9 || cclass == 4 {
229:                push_token(
230:                    &mut tokens,
231:                    str_buf.to_ascii_uppercase(),
232:                    TOKEN_NAME,
233:                );
234:                str_buf.clear();
235:                state = 0;
236:                continue;
237:            }
238:            state = 0;
239:            continue;
240:        }
241:
242:        if state == ST_STRING {
243:            if cclass == 8 {
244:                state = ST_STRINGQUOTE;
245:                i += 1;
246:                continue;
247:            }
248:            if cclass == 4 {
249:                state = 0;
250:                continue;
251:            }
252:            str_buf.push(ch);
253:            i += 1;
254:            continue;
255:        }
256:
257:        if state == ST_STRINGQUOTE {
258:            if cclass == 8 {
259:                str_buf.push('"');
260:                state = ST_STRING;
261:                i += 1;
262:                continue;
263:            }
264:            push_token(&mut tokens, str_buf.clone(), TOKEN_STRING);
265:            str_buf.clear();
266:            state = 0;
267:            continue;
268:        }
269:
270:        if state == ST_SPECIAL {
271:            if str_buf.ends_with('!') {
272:                push_token(&mut tokens, str_buf.clone(), TOKEN_NAME);
273:                str_buf.clear();
274:                state = 0;
275:                continue;
276:            }
277:            if cclass == 4 {
278:                state = 0;
279:                continue;
280:            }
281:            str_buf.push(ch);
282:            i += 1;
283:            continue;
284:        }
285:
286:        if state == 0 {
287:            if cclass == 1 {
288:                str_buf.push(ch);
289:                state = ST_NUM;
290:                i += 1;
291:                continue;
292:            }
293:            if cclass == 2 {
294:                str_buf.push(ch);
295:                had_decimal = true;
296:                state = ST_NUM;
297:                i += 1;
298:                continue;
299:            }
300:            if cclass == 5 || cclass == 6 {
301:                str_buf.push(ch);
302:                state = ST_ALPHA;
303:                i += 1;
304:                continue;
305:            }
306:            if cclass == 10 {
307:                str_buf.push(ch);
308:                state = ST_SPECIAL;
309:                i += 1;
310:                continue;
311:            }
312:            if cclass == 3 {
313:                let mut op = String::from(ch);
314:                if !tokens.is_empty() {
315:                    let last = tokens.last().unwrap();
316:                    if last.kind == TOKEN_OP {
317:                        let pair = format!("{}{}", last.text, ch);
318:                        if pair == "<=" || pair == ">=" || pair == "<>" {
319:                            tokens.pop();
320:                            op = pair;
321:                        }
322:                    }
323:                }
324:                let mut emit = op.clone();
325:                if emit == ">=" {
326:                    emit = "G".to_string();
327:                } else if emit == "<=" {
328:                    emit = "L".to_string();
329:                } else if emit == "<>" {
330:                    emit = "N".to_string();
331:                }
332:                push_token(&mut tokens, emit, TOKEN_OP);
333:                i += 1;
334:                continue;
335:            }
336:            if cclass == 8 {
337:                str_buf.clear();
338:                state = ST_STRING;
339:                i += 1;
340:                continue;
341:            }
342:            if cclass == 9 || cclass == 4 {
343:                i += 1;
344:                continue;
345:            }
346:            i += 1;
347:        }
348:    }
349:
350:    tokens
351:}
352:
353:#[derive(Clone, Copy, Debug, Default)]
354:struct Cr {
355:    col: i32,
356:    row: i32,
357:}
358:
359:fn rc_colname(c: i32) -> String {
360:    let mut n = c;
361:    let mut s = String::new();
362:    while n > 0 {
363:        let rem = ((n - 1) % 26) as u8;
364:        s.insert(0, (b'A' + rem) as char);
365:        n = (n - 1) / 26;
366:    }
367:    s
368:}
369:
370:fn coord_to_cr(cr: &str) -> Cr {
371:    let mut col = 0i32;
372:    let mut row = 0i32;
373:    for ch in cr.chars() {
374:        if ch == '$' {
375:            continue;
376:        }
377:        if ch.is_ascii_digit() {
378:            row = row * 10 + ch.to_digit(10).unwrap_or(0) as i32;
379:        } else if ch.is_ascii_alphabetic() {
380:            col = col * 26 + i32::from(ch.to_ascii_uppercase() as u8 - b'A' + 1);
381:        }
382:    }
383:    Cr { col, row }
384:}
385:
386:fn cr_to_coord(col: i32, row: i32) -> String {
387:    format!("{}{}", rc_colname(col), row)
388:}
389:
390:fn emit_string(text: &str) -> String {
391:    let escaped = text.replace('"', "\"\"");
392:    format!("\"{escaped}\"")
393:}
394:
395:fn rewrite_offset(formula: &str, coloffset: i32, rowoffset: i32) -> String {
396:    let tokens = parse_formula_into_tokens(formula);
397:    let mut out = String::new();
398:    for tok in tokens {
399:        match tok.kind {
400:            TOKEN_COORD => {
401:                let mut cr = coord_to_cr(&tok.text);
402:                let abs_col = tok.text.starts_with('$');
403:                let abs_row = tok.text.contains('$') && tok.text.rfind('$').unwrap_or(0) > 0;
404:                let mut newcr = String::new();
405:                if abs_col {
406:                    newcr.push('$');
407:                }
408:                if !abs_col {
409:                    cr.col += coloffset;
410:                }
411:                newcr.push_str(&rc_colname(cr.col));
412:                if abs_row {
413:                    newcr.push('$');
414:                }
415:                if !abs_row {
416:                    cr.row += rowoffset;
417:                }
418:                newcr.push_str(&cr.row.to_string());
419:                if cr.row < 1 || cr.col < 1 {
420:                    newcr = "#REF!".to_string();
421:                }
422:                out.push_str(&newcr);
423:            }
424:            TOKEN_STRING => out.push_str(&emit_string(&tok.text)),
425:            TOKEN_OP => out.push_str(expand_op(&tok.text)),
426:            _ => out.push_str(&tok.text),
427:        }
428:    }
429:    out
430:}
431:
432:fn rewrite_adjust(
433:    formula: &str,
434:    col: i32,
435:    coloffset: i32,
436:    row: i32,
437:    rowoffset: i32,
438:) -> String {
439:    let tokens = parse_formula_into_tokens(formula);
440:    let mut out = String::new();
441:    let mut sheetref = false;
442:    for tok in tokens {
443:        let mut text = tok.text.clone();
444:        if tok.kind == TOKEN_OP {
445:            if text == "!" {
446:                sheetref = true;
447:            } else if text != ":" {
448:                sheetref = false;
449:            }
450:            text = expand_op(&text).to_string();
451:        }
452:        if tok.kind == TOKEN_COORD {
453:            let mut cr = coord_to_cr(&text);
454:            if (coloffset < 0 && cr.col >= col && cr.col < col - coloffset)
455:                || (rowoffset < 0 && cr.row >= row && cr.row < row - rowoffset)
456:            {
457:                if !sheetref {
458:                    cr.col = 0;
459:                    cr.row = 0;
460:                }
461:            }
462:            if !sheetref {
463:                if cr.col >= col {
464:                    cr.col += coloffset;
465:                }
466:                if cr.row >= row {
467:                    cr.row += rowoffset;
468:                }
469:            }
470:            let abs_col = text.starts_with('$');
471:            let abs_row = text.contains('$') && text.rfind('$').unwrap_or(0) > 0;
472:            let mut newcr = String::new();
473:            if abs_col {
474:                newcr.push('$');
475:            }
476:            newcr.push_str(&rc_colname(cr.col));
477:            if abs_row {
478:                newcr.push('$');
479:            }
480:            newcr.push_str(&cr.row.to_string());
481:            if cr.row < 1 || cr.col < 1 {
482:                newcr = "#REF!".to_string();
483:            }
484:            text = newcr;
485:        } else if tok.kind == TOKEN_STRING {
486:            text = emit_string(&tok.text);
487:        }
488:        out.push_str(&text);
489:    }
490:    out
491:}
492:
493:fn rewrite_replace(formula: &str, moved_to: &[(String, String)]) -> String {
494:    let map: HashMap<String, String> = moved_to
495:        .iter()
496:        .map(|(k, v)| (k.to_ascii_uppercase(), v.clone()))
497:        .collect();
498:    let tokens = parse_formula_into_tokens(formula);
499:    let mut out = String::new();
500:    let mut sheetref = false;
501:    for tok in tokens {
502:        let mut text = tok.text.clone();
503:        if tok.kind == TOKEN_OP {
504:            if text == "!" {
505:                sheetref = true;
506:            } else if text != ":" {
507:                sheetref = false;
508:            }
509:            text = expand_op(&text).to_string();
510:        }
511:        if tok.kind == TOKEN_COORD {
512:            let cr = coord_to_cr(&text);
513:            let coord = cr_to_coord(cr.col, cr.row);
514:            if !sheetref {
515:                if let Some(dest) = map.get(&coord) {
516:                    let dest_cr = coord_to_cr(dest);
517:                    let abs_col = text.starts_with('$');
518:                    let abs_row = text.contains('$') && text.rfind('$').unwrap_or(0) > 0;
519:                    let mut newcr = String::new();
520:                    if abs_col {
521:                        newcr.push('$');
522:                    }
523:                    newcr.push_str(&rc_colname(dest_cr.col));
524:                    if abs_row {
525:                        newcr.push('$');
526:                    }
527:                    newcr.push_str(&dest_cr.row.to_string());
528:                    text = newcr;
529:                }
530:            }
531:        } else if tok.kind == TOKEN_STRING {
532:            text = emit_string(&tok.text);
533:        }
534:        out.push_str(&text);
535:    }
536:    out
537:}
538:
539:pub fn offset_formula_coords(formula: &str, coloffset: i32, rowoffset: i32) -> String {
540:    rewrite_offset(formula, coloffset, rowoffset)
541:}
542:
543:pub fn adjust_formula_coords(
544:    formula: &str,
545:    col: i32,
546:    coloffset: i32,
547:    row: i32,
548:    rowoffset: i32,
549:) -> String {
550:    rewrite_adjust(formula, col, coloffset, row, rowoffset)
551:}
552:
553:pub fn replace_formula_coords(formula: &str, moved_to: &[(String, String)]) -> String {
554:    rewrite_replace(formula, moved_to)
555:}
556:
557:#[unsafe(no_mangle)]
558:pub extern "C" fn formula_ref_alloc(len: usize) -> *mut u8 {
559:    let mut buf = Vec::with_capacity(len);
560:    buf.resize(len, 0);
561:    let ptr = buf.as_mut_ptr();
562:    std::mem::forget(buf);
563:    ptr
564:}
565:
566:#[unsafe(no_mangle)]
567:pub unsafe extern "C" fn formula_ref_dealloc(ptr: *mut u8, len: usize) {
568:    if !ptr.is_null() && len > 0 {
569:        drop(unsafe { Vec::from_raw_parts(ptr, len, len) });
570:    }
571:}
572:
573:#[unsafe(no_mangle)]
574:pub unsafe extern "C" fn formula_ref_rewrite(
575:    mode: i32,
576:    formula_ptr: *mut u8,
577:    formula_len: usize,
578:    a: i32,
579:    b: i32,
580:    c: i32,
581:    d: i32,
582:    map_ptr: *mut u8,
583:    map_len: usize,
584:) -> i32 {
585:    let formula_bytes = unsafe { std::slice::from_raw_parts(formula_ptr, formula_len) };
586:    let formula = match std::str::from_utf8(formula_bytes) {
587:        Ok(s) => s,
588:        Err(_) => {
589:            set_result(b"invalid utf-8 formula");
590:            return 1;
591:        }
592:    };
593:
594:    let result = match mode {
595:        1 => offset_formula_coords(formula, a, b),
596:        2 => adjust_formula_coords(formula, a, b, c, d),
597:        3 => {
598:            let map_bytes = unsafe { std::slice::from_raw_parts(map_ptr, map_len) };
599:            let map_str = match std::str::from_utf8(map_bytes) {
600:                Ok(s) => s,
601:                Err(_) => {
602:                    set_result(b"invalid utf-8 map");
603:                    return 2;
604:                }
605:            };
606:            let mut pairs = Vec::new();
607:            for line in map_str.lines() {
608:                if line.is_empty() {
609:                    continue;
610:                }
611:                let Some((from, to)) = line.split_once('=') else {
612:                    continue;
613:                };
614:                pairs.push((from.trim().to_string(), to.trim().to_string()));
615:            }
616:            replace_formula_coords(formula, &pairs)
617:        }
618:        _ => {
619:            set_result(b"unknown rewrite mode");
620:            return 3;
621:        }
622:    };
623:
624:    set_result(result.as_bytes());
625:    0
626:}
627:
628:#[unsafe(no_mangle)]
629:pub extern "C" fn formula_ref_result_ptr() -> *const u8 {
630:    let guard = RESULT.lock().expect("result mutex poisoned");
631:    guard.as_ptr()
632:}
633:
634:#[unsafe(no_mangle)]
635:pub extern "C" fn formula_ref_result_len() -> usize {
636:    let guard = RESULT.lock().expect("result mutex poisoned");
637:    guard.len()
638:}
639:
```

