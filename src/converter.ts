'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ReviewPoint } from './reviewPointManager';

export function convert() 
{
    try {
        let json: string = fs.readFileSync(
            path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath, 
                ".vscode",
                "vscode-review.json")).toString();
        
        let json_obj = JSON.parse(json);
        let rp_list :Array<ReviewPoint> = json_obj.rp_list;

        let html :string = "";

        html += "<table>";

        let counter = 1;
        rp_list.forEach(rp => {
            html += "<tr>";
            html += "<td>" + "</td>"; // Doc No.

            if(rp.history.length > 0){
                html += "<td>" + rp.history[rp.history.length - 1].version + "</td>"; // DR No.
                html += "<td>" + (counter++) + "</td>"; // 指摘No
                html += "<td>" + rp.history[rp.history.length - 1].author + "</td>"; // 指摘者
                html += "<td>" + "</td>"; // 指摘日
                html += "<td>" + "</td>"; // ページ番号
                html += "<td>" + "</td>"; // キーワード
                html += "<td>" + "</td>"; // (指摘概要)
                html += "<td>" + "</td>"; // 指摘詳細
                html += "<td>" + "</td>"; // 処置担当
                html += "<td>" + "</td>"; // 処置内容
                html += "<td>" + "</td>"; // 処置記入日
                html += "<td>" + "</td>"; // 処置完了日
                html += "<td>" + "</td>"; // 完了判定
                html += "<td>" + "</td>"; // 処置不承知内容
                html += "<td>" + "</td>"; // 指摘要因
                html += "<td>" + "</td>"; // 指摘属性
                html += "<td>" + "</td>"; // 作り込み要因
                html += "<td>" + "</td>"; // 指摘要因
                html += "<td>" + "</td>"; // 指摘属性
                html += "<td>" + "</td>"; // 作り込みフェーズ
                html += "<td>" + "</td>"; // 備考
            } 
            else {
                html += "<td>" + rp.version + "</td>"; // DR No.
                html += "<td>" + (counter++) + "</td>"; // 指摘No
            }

            
            

            html += "</tr>";
        });
        html += "</table>";

        vscode.window.showErrorMessage("convert was succeeded!");
    }
    catch
    {
        vscode.window.showErrorMessage("convert was failed.");
        return;
    }
}