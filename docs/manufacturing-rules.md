# Manufacturing rules — provisional foundation

No current geometry is certified casting-ready. No production release is enabled by Milestone 1. The database rejects any job transition to released; enabling that requires a later reviewed migration and validation/release service.

## Versioned constraints

| Profile | Face dimensions | Max relief | Min wall | Min feature | Approval |
|---|---|---|---|---|---|
| Proposed ring | 12–20 mm width/height | 3.5 mm | 1.8 mm | 0.6 mm | Provisional |
| Proposed pendant | 14–22 mm width/height | 2.5 mm | 1.4 mm | 0.6 mm | Provisional |
| Proposed distinct signet | 14–20 mm width/height | 3.0 mm | 1.8 mm | 0.6 mm | Provisional |

These numbers are user-supplied candidate rules, not measured minima or maker specifications. The registry retains a separate legacy-ring-preview profile matching the existing face dimensions. Its wall/feature limits are unknown. Nominal head offset is not global wall thickness. The proposed ring profile deliberately does not silently override Slim/Bar settings.

Numeric rules for future families, alloy-specific shrinkage, max volume, supported ground extent, loop aperture, attachment strength and polishing allowance remain unknown. Null means unconfirmed, never zero or pass. All listed alloys are candidate compatibility only.

## Validation and output

Unknown checks stay not_run; failed configurations are rejected. Structural/attachment checks and maker approval are mandatory before release. Engraving geometry is unimplemented; an engraving request is represented in the data but blocks generation, rather than being silently omitted. Terrain design validation does not transfer product validation to another mount.

Future review samples use binary STL coordinates in mm and mesh-based 3DM with explicit mm units and 1:1 scale. No NURBS, STEP or castability claim. Milestone 1 defines provenance only and generates no production files. Source data and manufacturing artefacts remain private; customer previews are separate. See [production output](production-output.md).

## Questions to resolve with the maker

1. Pendant relief within a border, flush face or another arrangement?
2. Alloy-specific wall thickness, feature width, relief and polishing allowances?
3. Fixed loop aperture and neck dimensions, including clearance for chain end fittings?
4. Integrated or separate/removable bail, and how is it joined and tested?
5. What makes the proposed Signet distinct from the current Terra Ring? Preferred dimensions and comfortable weight?
6. Reverse/interior engraving before or after casting, with what depth and clearance?
7. Mesh-based 3DM acceptable, and which Rhino version?
8. Who adds shrinkage compensation, supports and sprues?
9. How is a physical sample accepted and who owns remake responsibility?

No messages have been sent to the manufacturer.
