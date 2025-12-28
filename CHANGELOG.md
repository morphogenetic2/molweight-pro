# Changelog

## [1.1.0] - 2025-12-28

### Added
- **New Unit**: Added `ng/µL` support with full mathematical integration across all tools.
- **Stock Details Badge**: Implementation of a dual-badge system in the Buffer Builder (Green "Stock" + Blue Concentration value).
- **Volume Sync Warning**: Added a smart detection system that warns when a dilution target volume differs from the global buffer recipe volume, with a one-click sync option.
- **Data Integrity Locks**: Automatic disabling of input fields for solutes added from the Dilution Calculator to preserve calculation consistency.

### Fixed
- **Subscript Bug**: Corrected stoichiometry subscripting to ignore hydrate multipliers (e.g., $2H_2O$ now correctly renders the multiplier as normal text).
- **Duplicate Declaration**: Resolved a build-breaking `volML` duplicate variable error in `BufferBuilder.tsx`.
- **Formatting Precision**: Implemented smart significant figure detection that trims trailing zeros (e.g., $2.5M$ instead of $2.500M$).
- **Mass Calculation Priority**: Refactored `calculateMass` to prioritize stock solution logic, preventing incorrect mass-based calculations for liquid stocks.

### Improved
- **Scientific Precision**: Standardized decimal rounding rules for all units (L, mL, µL, g, mg, M, mM, etc.) based on laboratory standards.
- **UI Layout**: Moved the "Stock" badge inside the chemical input field for a cleaner, more integrated look.
- **Integration UX**: Appended stock concentration details (e.g., "2.5M stock") to chemical names when transferring from Dilution to Buffer.
