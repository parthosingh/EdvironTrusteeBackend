import { Injectable } from '@nestjs/common';

@Injectable()
export class CashfreeService {
    q: {
        promise: ()=>Promise<any>,
        resolve: (value?: any) => void
    }[] = [];
    constructor() {
        setInterval(() => {
            this.process();
        }, 1000);
    }
    enqueue(p: ()=>Promise<any>): Promise<any> {
        return new Promise((resolve, reject) => {
            this.q.push({
                promise: p,
                resolve,
            });
        })
    }
    async process() {
        if (this.q.length === 0) return;
        const p = this.q.shift();
        try{
            p.resolve(await p.promise());
        } catch (e) {
            console.error(e);
        }
    }

}
