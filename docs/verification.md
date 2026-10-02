# Verification and current status

This page separates automated repository checks from checks performed against the deployed services.

## Automated checks recorded in the repository

The most recent recorded project run reported:

- Backend: 21 pytest tests passing.
- Frontend: 25 Vitest tests passing.
- TypeScript check and production Vite build passing.
- ESLint with zero errors and seven existing Fast Refresh warnings.
- Saved npm and Python audit snapshots with zero known advisories at the time they were generated.
- ONNX/PyTorch logit parity maximum absolute difference: (3.58\times10^{-6}) on eight validation examples.

Re-run current checks before release using the commands in [Getting started](getting-started.md). Saved dependency audit files are snapshots, not guarantees about future advisories.

## Live smoke checks

Confirmed on 2 October 2026:

- Render `/health` reports the validated ONNX model as ready.
- Render `/insights` returns aggregate NIH cohort and model evaluation information.
- Vercel serves the Radiant landing page and imaging workspace.
- The Research & model panel loads the aggregate values from the Render API, verifying frontend-to-backend connectivity and CORS.
- The deployed chatbot returned a clear Groq response to a general, non-personal test question.

Not claimed by this smoke test:

- A real-patient image was not uploaded.
- Production image prediction and report download/print were not exercised end-to-end.
- A single synthetic prediction does not validate medical performance.
- The aggregate cohort record itself notes that the model's original fast pass did not exhaustively verify image integrity and near duplicates.

## Clinical interpretation

The app is a student/research demo. Report-derived labels, class imbalance, uncertain external generalization, low positive predictive value, and the candidate's lower sensitivity than the baseline prevent clinical claims. Passing software tests and deployment smoke checks only verify software behavior and connectivity.
