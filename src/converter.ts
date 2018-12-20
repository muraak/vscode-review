'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ReviewPoint, ReviewPointManager } from './reviewPointManager';


export function convert(excel_path: string) 
{
    try {
        let json: string = fs.readFileSync(
            path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath, 
                ".vscode",
                "vscode-review.json")).toString();
        
        let json_obj = JSON.parse(json);
        let rp_list :Array<ReviewPoint> = json_obj.rp_list;

        const XlsxPopulate = require('xlsx-populate');
        XlsxPopulate.fromFileAsync(path.resolve(excel_path)).then((workbook :any) => {
            
            let sheet = workbook.sheet("指摘一覧");
            
            let rp_counter = 39;

            rp_list.forEach(rp => {
                sheet.cell("F" + rp_counter).value(rp.history[0].version); // DR No.
                sheet.cell("G" + rp_counter).value(rp_counter -38); // 指摘No
                sheet.cell("H" + rp_counter).value(detectReviewer(rp, json_obj)); // 指摘者
                if(rp.add_time) { sheet.cell("I" + rp_counter).value(new Date(rp.add_time)).style("numberFormat", "'yy/mm/dd"); } // 指摘日
                sheet.cell("Q" + rp_counter).value(summarizeComment(ReviewPointManager.REVIEWER, rp, json_obj)); // 指摘詳細
                sheet.cell("R" + rp_counter).value(detectReviewee(rp, json_obj)); // 処置担当
                sheet.cell("S" + rp_counter).value(summarizeComment(ReviewPointManager.REVIEWEE, rp, json_obj)); // 処置内容
                if(rp.done_time) { sheet.cell("T" + rp_counter).value(new Date(rp.done_time)).style("numberFormat", "'yy/mm/dd"); }// 指摘日
                if(rp.isClosed === true) { sheet.cell("V" + rp_counter).value("●：確認完了");} // 完了判定
                // 処置不承知内容は記載不要とする（バージョンで管理・表示しているので）
                if(getNameFromDefinedTable("BC", "factor_reviewer", rp, sheet)){ 
                    sheet.cell("Y" + rp_counter).value(getNameFromDefinedTable("BC", "factor_coder", rp, sheet)); } // 指摘要因（担当者）
                if(getNameFromDefinedTable("BL", "make_factor", rp, sheet)){ 
                    sheet.cell("AA" + rp_counter).value(getNameFromDefinedTable("BL", "make_factor", rp, sheet)); } // 作込み要因（担当者）
                if(getNameFromDefinedTable("AX", "factor_reviewer", rp, sheet)){ 
                    sheet.cell("AB" + rp_counter).value(getNameFromDefinedTable("AX", "factor_reviewer", rp, sheet)); } // 指摘要因（レビューア）
                if(getNameFromDefinedTable("BP", "attribute_reviewer", rp, sheet)){ 
                    sheet.cell("AC" + rp_counter).value(getNameFromDefinedTable("BP", "attribute_reviewer", rp, sheet)); } // 指摘属性（レビューア）
                if(getNameFromDefinedTable("BT", "phase", rp, sheet)){ 
                    sheet.cell("AD" + rp_counter).value(getNameFromDefinedTable("BT", "phase", rp, sheet)); } // 作込みフェーズ

                rp_counter++;
            });

            workbook.toFileAsync(path.resolve(excel_path));

            vscode.window.showInformationMessage("convert was succeeded!");
        },
        (error :any) => {
            vscode.window.showErrorMessage(error.message);
        });
    }
    catch
    {
        vscode.window.showErrorMessage("convert was failed.");
        return;
    }
}

function summarizeComment(tgt_part :number, rp :ReviewPoint, json_obj :any) 
{
    let comment = "";

    rp.history.forEach(history => {
        let part = json_obj.part[history.version];
        if(part === tgt_part) {
            comment += "ver." + history.version + ": <br/>"  + history.comment + "<br/>";
        }
    });
    let part_er = json_obj.part[rp.version];
    if(part_er === tgt_part) {
        comment += "ver." + rp.version + ": <br/>"  + rp.comment + "<br/>";
    }

    var h2p = require('html2plaintext');
    
    return h2p(comment);
}

function detectReviewee(rp :ReviewPoint, json_obj :any) {
    return rp.history.find(it => 
            { return  json_obj.part[it.version] ===  ReviewPointManager.REVIEWEE;
        })!.author;
}

function detectReviewer(rp :ReviewPoint, json_obj :any) {
    return rp.history.find(it => 
            { return  json_obj.part[it.version] ===  ReviewPointManager.REVIEWER;
        })!.author;
}

function getNameFromDefinedTable(row :string, key :string, rp :ReviewPoint, sheet :any) :string | undefined {
    let offset_value = rp.options.find(it => { return it.key === key; })!.value;

    if(offset_value === 0) {
        return undefined;
    }
    else {
        return sheet.cell(row + (3 + offset_value)).value();
    }
}