# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-03-21

### Added
- **Duplicate Document Functionality**: Introduced a "Duplicate" button in invoice, proforma invoice, and credit note creators to quickly copy existing items, customers, and data into a new draft.

## [1.0.3] - 2026-02-24

### Added
- **VAT Calculator**: Introduced a new VAT calculator for line items in Invoice, Credit Note, and Proforma Invoice creators, allowing users to calculate totals based on gross or net amounts.
- **Localization**: Added comprehensive translations for Bulgarian and English across all major UI components, including:
    - `CompanySettings`
    - `CreateCreditNote`
    - `CreateInvoice`
    - `CreateProformaInvoice`
    - `Customers`
    - `Dashboard`
    - `Documents`
    - `Products`

### Changed
- Updated internal electron build scripts in `package.json` to use `@electron/rebuild`.
- Upgraded `electron-builder` and `postcss` dependencies.

## [1.0.2] - 2026-02-14
- Initial release with basic invoicing features.
