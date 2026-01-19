from typing import List, Tuple

from sqlalchemy.orm import Session

from app.models.student_model import Student
from app.schemas.hr_schema import ParsedRequirement


class RankingService:
    """
    Rule-based student ranking.
    This is CPU-only and offline, but the design allows plugging in an LLM later.
    """

    @staticmethod
    def rank_students_for_requirement(
        db: Session, requirement: ParsedRequirement
    ) -> List[Tuple[Student, float]]:
        students = db.query(Student).all()
        ranked: List[Tuple[Student, float]] = []

        for student in students:
            score = 0.0

            # PS level – highest priority (weight 0.5)
            score += (student.ps_level / 100.0) * 50

            # Domain match – weight 0.25
            if student.domain.lower() == requirement.role.lower():
                score += 25

            # CGPA – weight 0.2 (assuming scale 0–10)
            score += (student.cgpa / 10.0) * 20

            # Department relevance – simple heuristic (weight 0.05)
            if requirement.role.lower() in student.department.lower():
                score += 5

            ranked.append((student, score))

        ranked.sort(key=lambda x: x[1], reverse=True)
        return ranked

    # Placeholder hook for future LLM integration (offline-hosted model)
    @staticmethod
    def refine_ranking_with_llm(ranked_students: List[Tuple[Student, float]]) -> List[Tuple[Student, float]]:
        """
        In future, this method can call an on-prem Llama 3.1 model.
        For now, it simply returns the rule-based ranking unchanged.
        """
        return ranked_students


