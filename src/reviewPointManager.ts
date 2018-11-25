'use strict';

import * as vscode from 'vscode';

export class ReviewPoint {
    public file :string;
    public range :vscode.Range;
    public comment :string;
    readonly id :string;

    constructor(file :string, range :vscode.Range)
    {
        this.file = file;
        this.range = range;
        const shortid = require('shortid');
        this.id = shortid.generate();
        this.comment = "add comment here.";
    }
}

export class ReviewPointManager {

    private rp_list :ReviewPoint[] = [];

    public findById(id :string)
    {
        let rp = this.rp_list.find(x => { return x.id === id;});

        if(rp)
        {
            return this.rp_list[this.rp_list.indexOf(rp)];
        }
        else{
            return undefined;
        }
    }

    public updateComment(cmt_id: string, comment :string)
    {
        let rp = this.findById(cmt_id.replace("cmt.", ""));
        
        if(rp) {
            if(comment !== rp.comment) {
                rp.comment = comment;
            }
        }
    }

    public add(file :string, range :vscode.Range)
    {
        this.rp_list.push(new ReviewPoint(file, range));
    }

    public remove(rmv_id :string)
    {
        let tgt = this.findById(rmv_id.replace("rmv.", ""));

        if(tgt)
        {
            this.rp_list.splice(this.rp_list.indexOf(tgt), 1);
        }
    }

    public getAsHtml()
    {
        let html :string = "";

        this.rp_list.forEach(element => {
            html += "<tr><td>";
            html += "<div id=" + element.id + " class='rp'>";
            html += "file: " + element.file + "<br/>";
            html += "position: (" + element.range.start.line.toString() + ", ";
            html += element.range.start.character.toString() + ")<br/>";
            html += "</div>";
            html += "comment: <br/>";
            html += "<div class='comment' style='margin-left: 30px;' id='cmt." + element.id + "'>" + element.comment + "</div>";
            html += "<button class='remove' id='rmv." + element.id  + "'>remove</button>";
            html += "</td></tr>";    
        });
    
        return html;
    }
}