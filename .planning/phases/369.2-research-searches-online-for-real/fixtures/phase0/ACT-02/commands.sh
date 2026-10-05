ls .github/workflows
grep -rnEic 'python' .github/workflows/
grep -rnEi 'python-version|setup-python|matrix|node-version|runs-on' .github/workflows/
grep -rln 'python3' tests/run-all-*.sh | wc -l
grep -rnE 'python3?' scripts/doctor.cjs | head
grep -rnE 'sys.version_info|version_info' scripts lib --include=*.cjs --include=*.sh -l | head
