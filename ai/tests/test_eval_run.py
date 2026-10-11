import pytest

from evals import run


@pytest.mark.parametrize("limit", ["0", "-3", "abc"])
def test_limit_must_be_a_positive_integer(
    limit: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr("sys.argv", ["evals.run", "--provider", "fake", "--limit", limit])

    with pytest.raises(SystemExit) as exit_info:
        run.main()

    assert exit_info.value.code == 2
    assert "--limit" in capsys.readouterr().err
