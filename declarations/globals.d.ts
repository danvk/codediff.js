import jquery from 'jquery';
import highlightjs from 'highlight.js';

declare global {
    export const $: JQueryStatic;
    export const hljs: typeof highlightjs;
}
