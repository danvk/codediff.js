import jquery from 'jquery';
import highlightjs from 'highlightjs';

declare global {
    export const $: JQueryStatic;
    export const hljs: typeof highlightjs;
}
