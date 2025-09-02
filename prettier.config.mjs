export default {
    printWidth: 120,
    arrowParens: 'always',
    singleQuote: true,
    tabWidth: 4,
    proseWrap: 'never',
    overrides: [
        {
            files: '*.ts',
            options: {
                importOrderParserPlugins: ['typescript'],
            },
        },
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
};
