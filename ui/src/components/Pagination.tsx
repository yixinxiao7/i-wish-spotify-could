import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
  } from "@/components/ui/pagination"

type PaginationProps = {
	offset: number;
	limit: number;
	total: number;
	currentPage: number;
	handleOffsetChange: (offset: number, currentPage: number) => void;
};

const AppPagination = ({
	offset,
	limit, 
	total,
	currentPage,
	handleOffsetChange}: PaginationProps) => {

		const lastPage = Math.ceil(total / limit);

    return(
			<Pagination>
				<PaginationContent>
					{currentPage != 1 && 
						<>
							<PaginationItem>
								<PaginationPrevious onClick={() => {
									handleOffsetChange(offset-limit, currentPage-1);
								}} />
							</PaginationItem>
							<PaginationItem>
								<PaginationLink onClick={() => handleOffsetChange(0, 1)}>
									1
								</PaginationLink>
							</PaginationItem>
						</>
					}
					{currentPage > 2 &&
						<>
							<PaginationItem>
								<PaginationEllipsis />
							</PaginationItem>
							<PaginationItem>
								<PaginationLink onClick={() =>
									handleOffsetChange(offset-limit, currentPage-1)}>
									{currentPage-1}
								</PaginationLink>
							</PaginationItem>
						</>         
					}
						<PaginationItem>
							<PaginationLink isActive={true}>
								{currentPage}
							</PaginationLink>
						</PaginationItem>
					{currentPage < lastPage-1 &&
						<>
							<PaginationItem>
								<PaginationLink onClick={() =>
									handleOffsetChange(offset+limit, currentPage+1)}>
									{currentPage+1}
								</PaginationLink>
							</PaginationItem>
							<PaginationItem>
								<PaginationEllipsis />
							</PaginationItem>
						</>
					}
					{currentPage != lastPage &&
						<>
							<PaginationItem>
								<PaginationLink onClick={() => {
										handleOffsetChange((lastPage-1)*limit, lastPage);
									}}>
										{lastPage}
								</PaginationLink>
							</PaginationItem>
							<PaginationItem>
								<PaginationNext onClick={() => {
									handleOffsetChange(offset+limit, currentPage+1);
								}} />
							</PaginationItem>
						</>
					}
				</PaginationContent>
			</Pagination>
    )
}

export default AppPagination;