from app.db.session import create_engine


def test_engine_hides_bound_parameters() -> None:
    engine = create_engine("postgresql+asyncpg://u:p@localhost/db")

    assert engine.sync_engine.hide_parameters is True
